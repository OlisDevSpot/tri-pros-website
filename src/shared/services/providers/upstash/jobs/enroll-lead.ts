import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'

import { createJob } from '../lib/create-job'

/**
 * Auto-enroll a single freshly-ingested lead into its source's default campaign
 * (source-anchored Setup + auto-enroll, spec 2026-06-17). Dispatched best-effort
 * from customerIntakeService.ingestLead when the source policy says
 * `enabled && autoEnroll && defaultCampaignId`. The gate decision lives at the
 * dispatch site; this job is a dumb executor.
 *
 * Payload is `{ customerId }` only — enroll() resolves the source's CURRENT
 * defaultCampaignId at run time (no campaignId pinned) and runs the full gate
 * chain (is-a-lead passes for a fresh ingest; DNC / phone / already-enrolled
 * still protect). System action → no requestedByUserId.
 *
 * Retry policy: deterministic precondition rejects (dnc_match / invalid_phone /
 * already_enrolled / no_dialable_campaign / not_a_lead) won't change on retry →
 * swallow + log. Throw on ct_api_failure or any non-precondition error so QStash
 * retries a transient CloudTalk / DB outage. Contrast graduate-from-campaign,
 * which uses dispatchOrThrow because a dropped dial-stop is a safety bug; a
 * dropped auto-enroll just means the lead isn't auto-dialed (admin can Enroll-all).
 */
export const enrollLeadJob = createJob(
  'enroll-lead',
  async (payload: { customerId: string }) => {
    const result = await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {
      customerId: payload.customerId,
    })
    if (result.success) {
      return
    }

    if (result.error.type === 'precondition-failed') {
      const isRetryable = result.error.reason === 'ct_api_failure'
      if (!isRetryable) {
        console.warn('[enroll-lead] skipped (terminal)', {
          customerId: payload.customerId,
          reason: result.error.reason,
        })
        return
      }
      throw new Error(`enroll-lead retryable failure for ${payload.customerId}: ${result.error.reason}`)
    }

    throw new Error(`enroll-lead retryable failure for ${payload.customerId}: ${result.error.type}`)
  },
)
