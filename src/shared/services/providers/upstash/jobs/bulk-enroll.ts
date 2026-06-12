import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { recordSyncError } from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'

import { createJob } from '../lib/create-job'

/**
 * Cherry-pick bulk enroll. Enqueued from the leads table "Enroll selected"
 * action with an admin-picked campaign. Enrolls each selected customer through
 * the enrollment service, which runs the full gate chain per-customer — so
 * DNC'd / non-lead / already-enrolled customers are skipped idempotently.
 *
 * Idempotent: re-runs skip active enrollments. Per-customer failures annotate
 * the participation row's last_sync_error (when a row exists) and the batch
 * continues — one bad lead never aborts the run.
 *
 * Ring-1 note: one-customer-at-a-time (each does its own upsertContact +
 * addTags). // @migration: chunk via cloudtalkClient.bulkContacts (≤10 ops/req).
 */
export const bulkEnrollJob = createJob(
  'bulk-enroll',
  async (payload: { customerIds: string[], campaignId: string, requestedByUserId: string }) => {
    let enrolled = 0
    let skipped = 0
    for (const customerId of payload.customerIds) {
      const result = await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {
        customerId,
        campaignId: payload.campaignId,
      })
      if (result.success) {
        enrolled++
      }
      else {
        skipped++
        const reason = result.error.type === 'precondition-failed'
          ? result.error.reason
          : result.error.type
        await recordSyncError(customerId, `bulk-enroll: ${reason}`)
      }
    }

    console.warn('[bulk-enroll] complete', {
      campaignId: payload.campaignId,
      requestedByUserId: payload.requestedByUserId,
      requested: payload.customerIds.length,
      enrolled,
      skipped,
    })
  },
)
