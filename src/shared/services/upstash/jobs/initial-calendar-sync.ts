import { schedulingService } from '@/shared/services/scheduling.service'
import { createJob } from '../lib/create-job'

export const initialCalendarSyncJob = createJob(
  'initial-calendar-sync',
  async (payload: { userId: string }) => {
    await schedulingService.connectCalendar(payload.userId)
  },
)
