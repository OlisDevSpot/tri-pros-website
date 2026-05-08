export const RESEND_BRAND_NAME = 'Tri Pros Remodeling'
export const RESEND_SENDER_MAILBOX = 'info@triprosremodeling.com'

export const RESEND_FROM = {
  /** Single canonical sender — keeping one (display name, mailbox) pair preserves domain reputation. */
  default: `${RESEND_BRAND_NAME} <${RESEND_SENDER_MAILBOX}>`,
} as const

export const RESEND_LEAD_INBOX = RESEND_SENDER_MAILBOX
