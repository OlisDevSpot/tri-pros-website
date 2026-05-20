// Meeting entity lifecycle callbacks. Orchestrate services + other DALs
// after CRUD operations succeed. see meetings DOCS.md for business rules.

import type { Meeting } from '@/shared/db/schema'
import type { AuthedContext } from '@/trpc/types'

import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { notificationService } from '@/shared/services/notification.service'
import { ably } from '@/shared/services/providers/upstash/realtime'
import { schedulingService } from '@/shared/services/scheduling.service'

export const meetingLifecycle = {
  // see ../../shared/entities/meetings/DOCS.md#meeting-owner-not-just-creator
  async onCreated(ctx: AuthedContext, row: Meeting) {
    await addParticipant(row.id, ctx.session.user.id, 'owner')

    if (row.scheduledFor) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.create] GCal push failed for ${row.id}:`, err))
    }
  },

  async onUpdated(ctx: AuthedContext, row: Meeting, meta: {
    previousRow: Meeting
    input: { id: string, data: Partial<Meeting> }
  }) {
    const { previousRow, input: { data } } = meta

    // Push to Google Calendar if schedule-relevant fields changed
    if ('scheduledFor' in data || 'meetingType' in data || 'agentNotes' in data) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.update] GCal push failed for ${row.id}:`, err))
    }

    // Push notify other participants when scheduledFor actually changed
    if (previousRow.scheduledFor !== row.scheduledFor) {
      void notificationService
        .notifyMeetingScheduledTimeChanged({
          meetingId: row.id,
          oldScheduledFor: previousRow.scheduledFor,
          newScheduledFor: row.scheduledFor,
          excludeUserId: ctx.session.user.id,
        })
        .catch(err => console.warn('[push] notifyMeetingScheduledTimeChanged failed:', err))
    }

    // Publish realtime event for cross-device sync
    void ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
      fields: Object.keys(data),
    })
  },

  async onDuplicated(ctx: AuthedContext, row: Meeting) {
    await addParticipant(row.id, ctx.session.user.id, 'owner')

    if (row.scheduledFor) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.duplicate] GCal push failed for ${row.id}:`, err))
    }
  },
}
