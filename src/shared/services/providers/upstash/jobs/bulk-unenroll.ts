import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { recordSyncError } from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'

import { createJob } from '../lib/create-job'

/**
 * Bulk unenroll selected leads (EPIC decision #18). Covers both non-DNC reasons:
 *   - 'disqualified' — bad lead, stop calling (also the per-source "Unenroll all")
 *   - 'removed'      — neutral pull, re-enrollable
 * Enqueued from the leads bulk action bar and the source "Unenroll all" button.
 * The per-customer gate chain runs in the service; failures annotate
 * last_sync_error and the batch continues. DNC is a separate job (bulk-dnc).
 */
export const bulkUnenrollJob = createJob(
  'bulk-unenroll',
  async (payload: { customerIds: string[], reason: 'disqualified' | 'removed', requestedByUserId: string }) => {
    let unenrolled = 0
    let skipped = 0
    for (const customerId of payload.customerIds) {
      const result = await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
        customerId,
        reason: payload.reason,
      })
      if (result.success && result.data.unenrolled) {
        unenrolled++
      }
      else {
        skipped++
        if (!result.success) {
          const reason = result.error.type === 'precondition-failed'
            ? result.error.reason
            : result.error.type
          await recordSyncError(customerId, `bulk-unenroll: ${reason}`)
        }
      }
    }

    console.warn('[bulk-unenroll] complete', {
      reason: payload.reason,
      requestedByUserId: payload.requestedByUserId,
      requested: payload.customerIds.length,
      unenrolled,
      skipped,
    })
  },
)
