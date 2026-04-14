import { accountingService } from '@/shared/services/accounting.service'
import { createJob } from '../lib/create-job'

export const syncQbPaymentJob = createJob(
  'sync-qb-payment',
  async ({ paymentId, realmId }: { paymentId: string, realmId: string }) => {
    await accountingService.syncPaymentStatus(paymentId, realmId)
  },
)
