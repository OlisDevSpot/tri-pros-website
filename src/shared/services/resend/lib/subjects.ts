import { RESEND_SHORT_BRAND_NAME } from '@/shared/services/resend/constants'

/**
 * Single source of truth for all Resend email subject lines.
 *
 * Conventions:
 * - Customer-facing subjects lead with an emoji + first name for attention + warmth.
 * - Internal-notification subjects lead with 🔔 so reps' inboxes can filter on it.
 * - Keep under ~40 chars where possible — Gmail mobile truncates around 38.
 */

/** Customer-facing — sent when the rep emails the proposal. */
export function proposalReadySubject(customerFirstName: string): string {
  return `🏠 ${customerFirstName}, your ${RESEND_SHORT_BRAND_NAME} proposal is ready`
}

/** Internal notification — sent to the rep when a customer opens their proposal. */
export function proposalViewedSubject(customerName: string): string {
  return `🔔 ${customerName} just opened their proposal`
}

/** Internal notification — sent to the lead inbox when someone books via the landing page. */
export function consultationScheduledSubject(): string {
  return 'Consultation scheduled!'
}

/** Internal notification — sent to the lead inbox on general inquiry form submit. */
export function generalInquirySubject(): string {
  return 'General Inquiry'
}
