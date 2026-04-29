import { RESEND_BRAND_NAME, RESEND_FROM, RESEND_SENDER_MAILBOX } from '@/shared/services/resend/constants'

/**
 * Build a personalized From-header. Rep's first name appears before the brand
 * for proposal email warmth ("Oliver at Tri Pros Remodeling <info@…>").
 *
 * Falls back to the default brand sender when the rep IS the brand
 * (e.g., the system/agent fallback user whose DB name is literally
 * "Tri Pros Remodeling") — avoids "Tri at Tri Pros Remodeling".
 */
export function buildSenderFrom(repName: string | null | undefined): string {
  const trimmed = repName?.trim()
  if (!trimmed || trimmed === RESEND_BRAND_NAME) {
    return RESEND_FROM.default
  }
  const firstName = trimmed.split(/\s+/)[0]
  return `${firstName} at ${RESEND_BRAND_NAME} <${RESEND_SENDER_MAILBOX}>`
}
