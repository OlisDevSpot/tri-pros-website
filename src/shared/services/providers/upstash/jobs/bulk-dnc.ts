import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'
import { complianceService } from '@/shared/services/voip/compliance.service'

import { createJob } from '../lib/create-job'

/**
 * Bulk mark Do-Not-Call (EPIC decision #18). Per customer: add to DNC
 * (reason 'admin') then unenroll (reason 'opted_out'). Enqueued from the leads
 * bulk action bar "Mark DNC". Idempotent — re-adding DNC / re-unenrolling is a
 * no-op. Per-customer failures are logged and the batch continues; one bad
 * lead never aborts the run.
 */
export const bulkDncJob = createJob(
  'bulk-dnc',
  async (payload: { customerIds: string[], requestedByUserId: string }) => {
    let marked = 0
    for (const customerId of payload.customerIds) {
      try {
        await complianceService.addToDnc({ customerId, reason: 'admin', addedByUserId: payload.requestedByUserId })
        await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, { customerId, reason: 'opted_out' })
        marked++
      }
      catch (error) {
        console.error('[bulk-dnc] failed for customer', { customerId, error })
      }
    }

    console.warn('[bulk-dnc] complete', {
      requestedByUserId: payload.requestedByUserId,
      requested: payload.customerIds.length,
      marked,
    })
  },
)
