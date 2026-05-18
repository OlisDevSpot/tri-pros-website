import { getAccountsWithGCalEnabled } from '@/shared/dal/server/accounts/google-calendar'
import { schedulingService } from '@/shared/services/scheduling.service'
import { createJob } from '../lib/create-job'

export const syncCalendarsJob = createJob(
  'sync-calendars',
  async (_payload: Record<string, never>) => {
    const accounts = await getAccountsWithGCalEnabled()

    for (const acct of accounts) {
      await schedulingService.handleInboundSync(acct.userId).catch((err) => {
        console.error(`[sync-calendars] handleInboundSync failed for ${acct.userId}:`, err)
      })

      await schedulingService.renewChannelIfNeeded(acct.userId).catch((err) => {
        console.error(`[sync-calendars] renewChannelIfNeeded failed for ${acct.userId}:`, err)
      })
    }
  },
)
