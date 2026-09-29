import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { meetingRemindersService } from '@/shared/services/voip/meeting-reminders.service'

import { createJob } from '../lib/create-job'

/**
 * The 6 pm day-before reminder batch. Scheduled externally (QStash schedule with
 * `CRON_TZ=America/Los_Angeles 0 18 * * *` via `pnpm reminders:cron:setup`, or Vercel
 * Cron hitting /api/cron/meeting-reminders). An empty payload means "tomorrow"; a
 * `dayKey` lets an admin re-run a specific day. Safe to retry: rows are claimed per send.
 */
export const sendMeetingRemindersJob = createJob(
  'send-meeting-reminders',
  async (payload: { dayKey?: string }) => {
    dalVerifySuccess(await meetingRemindersService.sendDayBeforeReminders(payload))
  },
)
