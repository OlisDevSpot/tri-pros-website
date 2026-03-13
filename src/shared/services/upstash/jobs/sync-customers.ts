import { syncAllCustomers } from '@/shared/dal/server/customers/api'
import { createJob } from '../lib/create-job'

export const syncCustomersJob = createJob(
  'sync-customers',
  async (_payload: Record<string, never>) => {
    await syncAllCustomers()
  },
)
