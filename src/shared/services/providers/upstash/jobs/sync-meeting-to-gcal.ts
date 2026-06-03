import { schedulingService } from '@/shared/services/scheduling.service'

import { createJob } from '../lib/create-job'

/**
 * Push (create or update) a meeting's GCal event on the centralized info@
 * calendar. Fired from `meetingServerSpec.hooks.{create,update}.after` via
 * `dispatchOrThrow` — a missed enqueue means the event drifts out of sync
 * with the DB row, which is the bug class this entire pipeline was built
 * to eliminate.
 *
 * Handler is idempotent: `schedulingService.syncMeeting` reads the current
 * DB row, computes the payload from scratch, and uses GCal etags for
 * optimistic concurrency. Safe to run twice on QStash retry.
 */
export const syncMeetingToGcalJob = createJob(
  'sync-meeting-to-gcal',
  async (payload: { meetingId: string }) => {
    await schedulingService.syncMeeting(payload.meetingId)
  },
)
