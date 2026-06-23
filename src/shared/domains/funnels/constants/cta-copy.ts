import type { MarketingBlockKind } from '@/shared/domains/funnels/types'

/**
 * Copy for the CTAs the landing injects between marketing blocks.
 *
 * The landing drops a CTA after every third block; a single repeated label
 * ("See if you qualify" everywhere) reads as nagging. Instead the label echoes
 * the section the visitor just finished reading, so each ask feels earned by its
 * context. Keyed by the PRECEDING block's kind; sections without bespoke copy
 * fall back to the plain qualify ask (covers the default-landing-blocks funnels).
 *
 * Copy stays offer-generic ("Showcase project/spot") rather than vertical-
 * specific ("kitchen") so the shared map is safe for every funnel. The footer is
 * the final, summary ask. Adjust wording to taste per funnel voice.
 */
export const INTERSTITIAL_CTA_FALLBACK = 'See if you qualify'

export const INTERSTITIAL_CTA_BY_SECTION: Partial<Record<MarketingBlockKind, string>> = {
  value: 'See what\'s possible for your home',
  process: 'Start your Showcase project',
  guarantee: 'Claim your Showcase spot',
}

export const FOOTER_CTA_LABEL = 'Ready? See if you qualify'
