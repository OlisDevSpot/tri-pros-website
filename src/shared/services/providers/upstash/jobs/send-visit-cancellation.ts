import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
// The meetings CRUD hook dispatches this job, and the root meetingService spreads that CRUD at load time:
// importing the root here would read it before it exists. The business child reaches the CRUD lazily.
import { meetingBusinessService } from '@/shared/modules/meetings/business/service'

import { createJob } from '../lib/create-job'

/** Dispatched when a meeting turns cancelled. Whether an email is due is decided here, at run time. */
export const sendVisitCancellationJob = createJob('send-visit-cancellation', async (payload: { meetingId: string }) => {
  const result = dalVerifySuccess(await meetingBusinessService.sendVisitCancellation(SYSTEM_CONTEXT, payload))
  console.warn('[send-visit-cancellation]', { meetingId: payload.meetingId, ...result })
})
