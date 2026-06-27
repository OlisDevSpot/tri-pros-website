/**
 * All funnel-footer copy that isn't already a company constant. Single home for
 * the legally-reviewed TCPA wording so no string literals live in the footer /
 * PII components. The trade name is injected by the caller from `ctx` (per
 * funnel), keeping these strings funnel-agnostic. see ../ui/footer/funnel-footer.tsx
 *
 * Wording reviewed via the Legal Compliance Checker on 2026-06-27 — re-review on
 * any change to the consent flow.
 */

/** One-line company blurb. `trade` is the funnel's trade name (from ctx). */
export function funnelFooterBlurb(trade: string): string {
  return `${trade} done right — Southern California's licensed, bonded & insured remodeling specialists.`
}

/**
 * Short proximate consent shown under the PII phone input (where the old consent
 * checkbox was). Submission itself is the agreement; the component appends the
 * functional Terms/Privacy links right after this lead-in. Deliberately brief —
 * the full TCPA disclosure (autodialed/prerecorded, STOP/HELP, msg rates) lives in
 * FUNNEL_FOOTER_DISCLOSURE, which now renders in the footer on every funnel step
 * (including this one). Re-review with the Legal Compliance Checker on any change.
 */
export const FUNNEL_SUBMIT_DISCLAIMER
  = 'By submitting, you agree to be contacted about your project; consent isn\'t a condition of purchase. Read our'

/** Fuller TCPA disclosure shown in the footer legal block (links rendered by the component). */
export const FUNNEL_FOOTER_DISCLOSURE
  = 'By submitting your information, you authorize Tri Pros Remodeling to contact you at the phone number provided by phone call, text message (SMS), and email regarding your remodeling project and related offers, including through automated telephone dialing technology and prerecorded or artificial voice messages. You understand that your consent is not a condition of purchasing any goods or services. Message frequency varies; message and data rates may apply. Reply STOP to unsubscribe at any time, or HELP for help. See our Terms of Service and Privacy Policy for details on how we handle your information.'
