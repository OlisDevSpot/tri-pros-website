import type { Meeting } from '@/shared/db/schema'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { clearMeetingGCalFields } from '@/shared/entities/meetings/dal/server/google-calendar'
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { getMeetingSchedule } from '@/shared/entities/meetings/dal/server/queries'
import { resolveMeetingOwnerId } from '@/shared/entities/meetings/lib/resolve-owner'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { deleteMeetingEventJob } from '@/shared/services/providers/upstash/jobs/delete-meeting-event'
import { graduateFromCampaignJob } from '@/shared/services/providers/upstash/jobs/graduate-from-campaign'
import { metaCapiEventJob } from '@/shared/services/providers/upstash/jobs/meta-capi-event'
import { notifyMeetingTimeChangedJob } from '@/shared/services/providers/upstash/jobs/notify-meeting-time-changed'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'
import { ably } from '@/shared/services/providers/upstash/realtime'

export const meetingCrud = createCrudDal(meetingServerSpec, () => ({
  hooks: {
    // The after-hook side-effects below (job dispatches, ably.publish, addParticipant on raw `db`) run
    // inline with no post-commit phase: threading a tx into meetingCrud.* fires them PRE-COMMIT with no
    // rollback, and addParticipant writes outside that tx.
    create: {
      // Authed callers: ownerId is ALWAYS server-resolved (off the `own Meeting` capability, never input
      // or a role string) so a wire client can't create a meeting owned by someone else.
      // SYSTEM_CONTEXT orchestrators have no session and supply ownerId themselves.
      async before(input, ctx) {
        if (!ctx.session) {
          return input
        }
        return { ...input, ownerId: await resolveMeetingOwnerId(ctx) }
      },
      // row.ownerId, not ctx.session.user.id, so the participant follows the actual owner on the
      // SYSTEM_CONTEXT path too. dispatchOrThrow: a missed enqueue must fail the mutation, not drop the event.
      async after(row: Meeting, _ctx) {
        const systemOwnerId = await getSystemOwnerId()
        // A system-owned (unassigned) meeting has no owner participant — info@ cannot attend.
        if (row.ownerId !== systemOwnerId) {
          await addParticipant(row.id, row.ownerId, 'owner')
        }

        if (row.scheduledFor) {
          await syncMeetingToGcalJob.dispatchOrThrow({ meetingId: row.id })
        }

        // A booked meeting ends the dialer's job — unenroll from any active campaign (idempotent).
        // dispatchOrThrow: stopping a live dial is not cosmetic.
        if (row.customerId) {
          await graduateFromCampaignJob.dispatchOrThrow({ customerId: row.customerId })

          // Best-effort dispatch — measurement is cosmetic.
          void metaCapiEventJob.dispatch({
            event: 'Schedule',
            args: { customerId: row.customerId, occurredAtIso: new Date().toISOString() },
          })
        }
      },
    },
    update: {
      async before(data, _ctx, { id }) {
        let next = data
        if (data.meetingOutcome) {
          const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
          if (pipeline != null) {
            next = { ...next, pipeline }
          }
        }
        // A confirmation holds for one appointment time; a moved meeting must be confirmed again.
        // Compared against the stored time so a same-time re-save (e.g. GCal sync) keeps it.
        if (data.scheduledFor && !('confirmedAt' in data)) {
          const current = await getMeetingSchedule(id)
          if (current?.confirmedAt && new Date(current.scheduledFor).getTime() !== new Date(data.scheduledFor).getTime()) {
            next = { ...next, confirmedAt: null }
          }
        }
        return next
      },
      // excludeUserId is optional: under SYSTEM_CONTEXT there is no actor to exclude.
      // Ably publish stays inline — routing it through QStash would add 100-300ms and defeat the point.
      async after(row: Meeting, ctx, meta) {
        const { previousRow, input: data } = meta

        // The fields the GCal event is built from (time, title prefix/color, description).
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

        // A newly-cancelled meeting leaves the shared calendar; the row is kept. The transition check prevents re-dispatch.
        if (
          previousRow.meetingOutcome !== 'cancelled'
          && row.meetingOutcome === 'cancelled'
          && row.gcalEventId
        ) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
          await clearMeetingGCalFields(row.id)
        }
      },
    },
    delete: {
      // Deliberately one-way: a GCal-side delete only clears the meeting's linkage fields, so an
      // accidental calendar delete never destroys app data.
      // dispatchOrThrow: a failed enqueue must surface to the deleting agent, not leave a silent orphan event.
      async before(row: Meeting) {
        if (row.gcalEventId) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
        }
      },
    },
  },
  // A duplicate is a fresh sit, not a continuation — only reschedule carries flow state forward.
  duplicate: {
    exclude: [
      'createdAt',
      'updatedAt',
      'meetingOutcome',
      'confirmedAt',
      'pipeline',
      'flowStateJSON',
      'agentNotes',
      'projectId',
      'gcalEventId',
      'gcalEtag',
      'gcalSyncedAt',
    ],
    // Loses to create.before on the authed path; the source.ownerId fallback keeps a SYSTEM_CONTEXT duplicate from crashing.
    overrides: (source, ctx) => ({
      ownerId: ctx.session?.user.id ?? source.ownerId,
    }),
  },
}))
