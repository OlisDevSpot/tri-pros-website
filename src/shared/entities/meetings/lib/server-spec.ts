import type { EntityServerSpec } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'

import {
  insertMeetingSchema,
  meetings,
  selectMeetingSchema,
} from '@/shared/db/schema'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { meetingVisibility } from '@/shared/entities/meetings/lib/visibility'
import { notificationService } from '@/shared/services/notification.service'
import { ably } from '@/shared/services/providers/upstash/realtime'
import { schedulingService } from '@/shared/services/scheduling.service'

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
      // Uses row.ownerId (not ctx.session.user.id) so the participant and the
      // GCal push follow the meeting's actual owner — correct for both the
      // authed UI path (row.ownerId === session.user.id by virtue of the
      // before hook) and the SYSTEM_CONTEXT orchestrator path.
      async after(row: Meeting, _ctx) {
        await addParticipant(row.id, row.ownerId, 'owner')

        if (row.scheduledFor) {
          void schedulingService
            .pushToGCal(row.ownerId, 'meeting', row.id)
            .catch(err => console.error(`[meetings.create] GCal push failed for ${row.id}:`, err))
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
      // Merged from lifecycle.ts onUpdated
      async after(row: Meeting, ctx, meta) {
        const { previousRow, input: data } = meta

        if ('scheduledFor' in data || 'meetingType' in data || 'agentNotes' in data) {
          void schedulingService
            .pushToGCal(ctx.session!.user.id, 'meeting', row.id)
            .catch(err => console.error(`[meetings.update] GCal push failed for ${row.id}:`, err))
        }

        if (previousRow.scheduledFor !== row.scheduledFor) {
          void notificationService
            .notifyMeetingScheduledTimeChanged({
              meetingId: row.id,
              oldScheduledFor: previousRow.scheduledFor,
              newScheduledFor: row.scheduledFor,
              excludeUserId: ctx.session!.user.id,
            })
            .catch(err => console.warn('[push] notifyMeetingScheduledTimeChanged failed:', err))
        }

        void ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
          fields: Object.keys(data),
        })
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
    overrides: (_source, ctx) => ({
      ownerId: ctx.session!.user.id,
    }),
  },
} satisfies EntityServerSpec<typeof meetings>
