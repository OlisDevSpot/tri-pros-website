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
 * Gate 5 — usable phone. Normalize to E.164 (US-default). Returns the
 * normalized number or null when it can't form a plausible E.164.
 *
 * Ring-1 normalizer (no libphonenumber dep): strip non-digits; accept a
 * 10-digit US number (prefix +1), an 11-digit 1-prefixed US number, or an
 * already-+-prefixed 11–15 digit international number. Anything else → null.
 */
export function normalizeToE164(phone: string | null | undefined): string | null {
  if (!phone) {
    return null
  }
  const hadPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  if (hadPlus) {
    return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null
  }
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return null
}
