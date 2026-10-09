import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingService } from '@/shared/modules/meetings/service'

import { createJob } from '../lib/create-job'

/** Published by the 8:30 AM Pacific schedule. */
export const sendRepConfirmationsJob = createJob('send-rep-confirmations', async () => {
  const report = dalVerifySuccess(await meetingService.business.sendRepConfirmations(SYSTEM_CONTEXT, { now: new Date() }))
  console.warn('[send-rep-confirmations]', report)
})
