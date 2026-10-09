import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingService } from '@/shared/modules/meetings/service'

import { createJob } from '../lib/create-job'

/** Published by the 6 PM Pacific schedule. A throw makes QStash retry; the run refuses a retry that lands too late. */
export const sendDayBeforeRemindersJob = createJob('send-day-before-reminders', async () => {
  const report = dalVerifySuccess(await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now: new Date() }))
  console.warn('[send-day-before-reminders]', report)
})
