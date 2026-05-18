import { accountingService } from '@/shared/services/accounting.service'
import { createJob } from '../lib/create-job'

export const syncQbInvoiceJob = createJob(
  'sync-qb-invoice',
  async ({ invoiceId, realmId }: { invoiceId: string, realmId: string }) => {
    await accountingService.syncInvoiceStatus(invoiceId, realmId)
  },
)
