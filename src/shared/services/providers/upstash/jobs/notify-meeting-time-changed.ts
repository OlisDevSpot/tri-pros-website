import { notificationService } from '@/shared/services/notification.service'

import { createJob } from '../lib/create-job'

/**
 * Send the "meeting time changed" push to every participant except the
 * acting user. Fired from `meetingServerSpec.hooks.update.after` when
 * `previousRow.scheduledFor !== row.scheduledFor`. Strict dispatch
 * because a dropped notification means a participant turns up at the
 * wrong time — actively misleading, not just absent.
 *
 * Handler is idempotent enough for QStash retry: web-push delivery is
 * already best-effort at the platform layer, and two identical
 * notifications inside the same retry window land as a single visible
 * one on most clients.
 */
export const notifyMeetingTimeChangedJob = createJob(
  'notify-meeting-time-changed',
  async (payload: {
    meetingId: string
    oldScheduledFor: string | null
    newScheduledFor: string | null
    excludeUserId?: string
  }) => {
    await notificationService.notifyMeetingScheduledTimeChanged(payload)
  },
)
