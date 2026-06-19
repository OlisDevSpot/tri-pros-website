// Pure enrollment-eligibility rules (EPIC decisions #15 + #16). Each is a small
// isolated function (args → result, no I/O) composed by the enrollment service.
// The two gates that require DB reads — "pre-meeting lead?" (derivedPipelineWhere)
// and "already actively enrolled?" — stay in the service as queries; everything
// expressible as a pure predicate lives here.
//
// Adding a new business rule = another function here + one more call in the
// service's gate chain. Never inline branching logic in the service.

import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'
import type { VoipCampaignsPolicy } from '@/shared/entities/lead-sources/schemas'

import { toE164 } from '@/shared/lib/phone'

// Reject reasons surfaced in DalReturn (decision #15). No status-based ones —
// there is no local campaign status under perfect separation.
export type EnrollmentRejectReason
  = | 'source_disabled'
    | 'no_dialable_campaign'
    | 'not_a_lead'
    | 'dnc_match'
    | 'invalid_phone'
    | 'already_enrolled'
    | 'ct_api_failure'

/** Gate 1 — per-source kill switch. Absent policy ⇒ treated as disabled (no guessing). */
export function isSourceEnabled(policy: VoipCampaignsPolicy | undefined): boolean {
  return policy?.enabled === true
}

/**
 * Gate — the target campaign is dialable: it is CT-active. Campaigns are pools,
 * NOT owned by a lead source (the catch-all belongs to none), so source binding
 * is intentionally NOT checked. A campaign always has a membership tag (the sync
 * skips tagless ones), so CT-active is the only runtime requirement.
 */
export function isCampaignDialable(campaign: VoipCampaign | null): boolean {
  if (!campaign) {
    return false
  }
  return campaign.ctStatus === 'active'
}

/** Gate 4 — DNC. A customer with `dncOptedOutAt` set is never enrollable. */
export function isDncBlocked(customer: { dncOptedOutAt: string | null }): boolean {
  return customer.dncOptedOutAt !== null
}

/**
 * Gate 5 — usable phone. Normalize to E.164 (US) for the dialer, or null when
 * it can't form a plausible US number. Thin alias over the shared `toE164`
 * (single source of truth for phone normalization — see @/shared/lib/phone);
 * kept as a named gate so the service's gate chain reads uniformly.
 */
export function normalizeToE164(phone: string | null | undefined): string | null {
  return toE164(phone)
}
