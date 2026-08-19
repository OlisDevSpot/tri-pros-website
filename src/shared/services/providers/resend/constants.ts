export const RESEND_BRAND_NAME = 'Tri Pros Remodeling'

/**
 * FROM identity for all outbound mail. A dedicated `notifications@` mailbox on
 * the root domain — NOT `info@` — so internal team notifications stop being
 * self-sends (From == To == info@), the aggravating factor in Gmail's own-domain
 * spoofing quarantine. Internal-mailbox delivery is unblocked by the Google
 * Workspace bypass — see docs/superpowers/plans/2026-08-11-email-deliverability-hardening.md
 */
export const RESEND_SENDER_MAILBOX = 'notifications@triprosremodeling.com'

export const RESEND_FROM = {
  /** Single canonical sender — one (display name, mailbox) pair preserves domain reputation. */
  default: `${RESEND_BRAND_NAME} <${RESEND_SENDER_MAILBOX}>`,
} as const

/**
 * Where internal leads are RECEIVED and where notifications route replies — the
 * real monitored Google mailbox. Deliberately DECOUPLED from the sender identity.
 */
export const RESEND_LEAD_INBOX = 'info@triprosremodeling.com'
