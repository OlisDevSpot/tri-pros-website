import { syncAllCustomers } from '@/shared/entities/customers/dal/server/queries'
import { createJob } from '../lib/create-job'

export const syncCustomersJob = createJob(
  'sync-customers',
  async (_payload: Record<string, never>) => {
    await syncAllCustomers()
  },
)
