import { schedulingService } from '@/shared/services/scheduling.service'

import { createJob } from '../lib/create-job'

/**
 * Delete a GCal event by identifier on the centralized info@ calendar.
 * Fired from `meetingServerSpec.hooks.delete.before` (the meeting row is
 * gone by the time this runs — payload carries the event id captured
 * pre-delete). Strict dispatch so a missed enqueue surfaces as a 500 on
 * the deleting agent's screen rather than silently leaving an orphan
 * event on the master calendar.
 *
 * Handler is idempotent: the provider swallows 404/410 (already-gone
 * events). Safe under QStash retry.
 */
export const deleteMeetingEventJob = createJob(
  'delete-meeting-event',
  async (payload: { gcalEventId: string }) => {
    await schedulingService.deleteMeetingEvent({ gcalEventId: payload.gcalEventId })
  },
)
