import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { listEnrollableLeadsBySource } from '@/shared/entities/customers/dal/server/queries'
import { getLeadSourceBySlug } from '@/shared/entities/lead-sources/dal/server/queries'
import { recordSyncError } from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'

import { createJob } from '../lib/create-job'

/**
 * Bulk "enroll all per source" (EPIC decision #11). Enqueued from the admin
 * "Enroll all" button with an admin-picked campaign. Pages eligible leads for
 * the source and enrolls each into the chosen campaign through the enrollment
 * service (which runs the full gate chain per-customer — so DNC'd / non-lead /
 * already-enrolled customers are skipped idempotently).
 *
 * Idempotent: re-runs skip active enrollments and re-enroll unenrolled rows.
 * Per-customer failures are recorded on the participation row's last_sync_error
 * (when a row exists) and logged; the batch continues — one bad lead never
 * aborts the run.
 *
 * Ring-1 note: enrollment goes one-customer-at-a-time through the service (each
 * does its own upsertContact + addTags). CT's bulk contacts API (≤10 ops/req)
 * is a ring-2 throughput optimization — // @migration: chunk via cloudtalkClient.bulkContacts.
 */
export const enrollSourceBatchJob = createJob(
  'enroll-source-batch',
  async (payload: { sourceSlug: string, campaignId: string, requestedByUserId: string }) => {
    const sourceResult = await getLeadSourceBySlug(payload.sourceSlug)
    if (!sourceResult.success || !sourceResult.data) {
      console.error('[enroll-source-batch] lead source not found', { sourceSlug: payload.sourceSlug })
      return
    }
    const leadSource = sourceResult.data

    const leadsResult = await listEnrollableLeadsBySource(leadSource.id)
    if (!leadsResult.success) {
      console.error('[enroll-source-batch] failed to list eligible leads', {
        sourceSlug: payload.sourceSlug,
        error: leadsResult.error,
      })
      return
    }

    let enrolled = 0
    let skipped = 0
    for (const customer of leadsResult.data) {
      const result = await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {
        customerId: customer.id,
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
        // Best-effort error annotation (no-op if the customer has no row yet).
        await recordSyncError(customer.id, `enroll-all: ${reason}`)
      }
    }

    console.warn('[enroll-source-batch] complete', {
      sourceSlug: payload.sourceSlug,
      campaignId: payload.campaignId,
      requestedByUserId: payload.requestedByUserId,
      eligible: leadsResult.data.length,
      enrolled,
      skipped,
    })
  },
)
