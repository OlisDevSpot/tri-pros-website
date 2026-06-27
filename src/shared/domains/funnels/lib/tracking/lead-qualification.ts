import type { FunnelAnswers } from '@/shared/domains/funnels/types'

/**
 * Whether a funnel lead should feed Meta's Lead optimization signal (the browser
 * `Lead` pixel + its server CAPI twin). Renters — the hero-entry `ownership`
 * question answered 'rent' — are STILL ingested into the CRM, but are a junk
 * optimization signal for homeowner-only showcase programs, so they fire NO Lead
 * event on either channel. Funnels without an `ownership` step have no such
 * answer and always fire. see ../../DOCS.md (the `Lead` section).
 *
 * `ownership` is a card-select step, so its stored answer is the option id
 * string ('own' | 'rent'); a missing/other answer is never strictly equal to
 * 'rent', so it returns true (fire).
 */
const OWNERSHIP_STEP_ID = 'ownership'
const RENTER_ANSWER = 'rent'

export function firesLeadOptimization(answers: FunnelAnswers): boolean {
  return answers[OWNERSHIP_STEP_ID] !== RENTER_ANSWER
}
