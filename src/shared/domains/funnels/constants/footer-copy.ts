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
 * Proximate consent shown directly under the PII submit button (replaces the
 * removed checkbox). Submission itself is the agreement; the component renders
 * functional Terms/Privacy links in the same block. Wording approved by the Legal
 * Compliance Checker on 2026-06-27 — re-review on any change.
 */
export const FUNNEL_SUBMIT_DISCLAIMER
  = 'By tapping the button above, you agree to our Terms and Privacy Policy and authorize Tri Pros Remodeling to contact you at the number provided by phone, text, and email about your project — including by autodialed and prerecorded/automated messages. Consent is not a condition of purchase. Msg frequency varies; msg & data rates may apply. Reply STOP to opt out, HELP for help.'

/** Fuller TCPA disclosure shown in the footer legal block (links rendered by the component). */
export const FUNNEL_FOOTER_DISCLOSURE
  = 'By submitting your information, you authorize Tri Pros Remodeling to contact you at the phone number provided by phone call, text message (SMS), and email regarding your remodeling project and related offers, including through automated telephone dialing technology and prerecorded or artificial voice messages. You understand that your consent is not a condition of purchasing any goods or services. Message frequency varies; message and data rates may apply. Reply STOP to unsubscribe at any time, or HELP for help. See our Terms of Service and Privacy Policy for details on how we handle your information.'
