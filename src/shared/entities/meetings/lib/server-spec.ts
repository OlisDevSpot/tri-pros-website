import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import {
  insertMeetingSchema,
  meetings,
  selectMeetingSchema,
} from '@/shared/db/schema'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { meetingVisibility } from '@/shared/entities/meetings/lib/visibility'
import { deleteMeetingEventJob } from '@/shared/services/providers/upstash/jobs/delete-meeting-event'
import { notifyMeetingTimeChangedJob } from '@/shared/services/providers/upstash/jobs/notify-meeting-time-changed'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'
import { ably } from '@/shared/services/providers/upstash/realtime'

const updateMeetingSchema = insertMeetingSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference. */
export const meetingSchemas = {
  insert: insertMeetingSchema,
  update: updateMeetingSchema,
}

export const meetingServerSpec = {
  entityName: MEETING,
  caslSubject: MEETING,
  visibility: meetingVisibility,
  table: meetings,
  schemas: {
    insert: insertMeetingSchema,
    update: updateMeetingSchema,
    select: selectMeetingSchema,
  },
  hooks: {
    create: {
      // see ../DOCS.md#meeting-owner-is-creator
      // Authenticated callers: ownerId is forced to ctx.session.user.id —
      // prevents wire clients from POSTing { ownerId: <someone-else> } and
      // creating a meeting owned by another user. SYSTEM_CONTEXT callers
      // (orchestrators like customers.createFromIntake) have ctx.session ===
      // null and supply ownerId explicitly — the hook passes their value
      // through unchanged.
      before(input, ctx) {
        if (ctx.session) {
          return { ...input, ownerId: ctx.session.user.id }
        }
        return input
      },
      // Merged from lifecycle.ts onCreated + onDuplicated (identical behavior).
      // Uses row.ownerId (not ctx.session.user.id) so the participant follows
      // the meeting's actual owner — correct for both the authed UI path
      // (row.ownerId === session.user.id by virtue of the before hook) and
      // the SYSTEM_CONTEXT orchestrator path. The GCal push is enqueued as a
      // QStash job — strict dispatch so a missed enqueue fails the mutation
      // rather than silently dropping the event.
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async after(row: Meeting, _ctx) {
        await addParticipant(row.id, row.ownerId, 'owner')

        if (row.scheduledFor) {
          await syncMeetingToGcalJob.dispatchOrThrow({ meetingId: row.id })
        }
      },
    },
    update: {
      // see ../DOCS.md#meeting-pipeline-storage-vs-derived
      before(data) {
        if (data.meetingOutcome) {
          const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
          if (pipeline != null) {
            return { ...data, pipeline }
          }
        }
        return data
      },
      // Merged from lifecycle.ts onUpdated.
      // Reads row.ownerId (not ctx.session.user.id) for parity with create.after —
      // SYSTEM_CONTEXT callers (e.g., inbound GCal sync, the new pipeline-stage
      // transition path that uses buildUserContext) must not crash here.
      // excludeUserId on the notification is optional — SYSTEM_CONTEXT means
      // no "actor" to exclude (notify all participants).
      //
      // Side-effect taxonomy:
      // - GCal sync + time-changed push → QStash jobs, dispatchOrThrow.
      //   Critical work; silent loss is the bug class this refactor closed.
      //   Parallelized via Promise.all to share the dispatch round-trip.
      // - Ably publish → inline await. Ephemeral realtime fan-out; routing
      //   through QStash would add 100-300ms of delay and defeat the point.
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async after(row: Meeting, ctx, meta) {
        const { previousRow, input: data } = meta

        // GCal-affecting fields on a meeting:
        // - scheduledFor → event start/end time
        // - meetingType → event title prefix and color (Fresh/Rehash/Project)
        // - agentNotes → event description body
        // - projectId → event title prefix flips to "Project:" + color flips
        const gcalFieldChanged = 'scheduledFor' in data
          || 'meetingType' in data
          || 'agentNotes' in data
          || 'projectId' in data
        const timeChanged = previousRow.scheduledFor !== row.scheduledFor

        const dispatches: Promise<unknown>[] = []
        if (gcalFieldChanged) {
          dispatches.push(syncMeetingToGcalJob.dispatchOrThrow({ meetingId: row.id }))
        }
        if (timeChanged) {
          dispatches.push(notifyMeetingTimeChangedJob.dispatchOrThrow({
            meetingId: row.id,
            oldScheduledFor: previousRow.scheduledFor,
            newScheduledFor: row.scheduledFor,
            excludeUserId: ctx.session?.user.id,
          }))
        }
        if (dispatches.length > 0) {
          await Promise.all(dispatches)
        }

        await ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
          fields: Object.keys(data),
        })
      },
    },
    delete: {
      // One-way GCal cleanup: deleting a meeting in-app deletes its event on
      // the centralized info@ calendar. The reverse direction is intentionally
      // NOT symmetric — cancelling an event in GCal clears the meeting's GCal
      // linkage fields (`clearMeetingGCalFields` in performInboundSync) but
      // leaves the meeting row intact, so an accidental GCal-side delete
      // doesn't destroy app data.
      //
      // Captured in `before` because by `after` the row is gone and we can no
      // longer read gcalEventId. The Google API call itself runs inside a
      // QStash job — strict dispatch so a failed enqueue surfaces to the
      // deleting agent rather than silently leaving an orphan event.
      // Failure mode: if the QStash dispatch itself succeeds but the eventual
      // job execution fails (auth, network, 5xx), QStash retries automatically;
      // the handler is idempotent (provider swallows 404/410 from already-gone
      // events). A future orphan-sweeper script can clean residue from cases
      // where every QStash retry exhausts.
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async before(id, _ctx) {
        const [row] = await db
          .select({ gcalEventId: meetings.gcalEventId })
          .from(meetings)
          .where(eq(meetings.id, String(id)))
          .limit(1)
        const gcalEventId = row?.gcalEventId
        if (gcalEventId) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId })
        }
      },
    },
  },
  // see ../DOCS.md#duplicate-cherry-picks-setup-fields
  // Default: copy full row minus PK. Exclude derived/outcome/calendar fields.
  // Routed through createImpl — `overrides` stamps ownerId, create.after adds participant.
  duplicate: {
    exclude: [
      'createdAt',
      'updatedAt',
      'meetingOutcome',
      'pipeline',
      'flowStateJSON',
      'agentNotes',
      'projectId',
      'gcalEventId',
      'gcalEtag',
      'gcalSyncedAt',
    ],
    // The create.before hook forces ownerId from session for authed callers
    // and passes input through for SYSTEM_CONTEXT — so this override is a
    // sane default that loses to before-hook on the authed path. Falls back
    // to source.ownerId so a SYSTEM_CONTEXT duplicate doesn't crash.
    overrides: (source, ctx) => ({
      ownerId: ctx.session?.user.id ?? source.ownerId,
    }),
  },
} satisfies EntityServerSpec<typeof meetings>
