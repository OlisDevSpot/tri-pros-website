import type { AdSpec, CampaignSpec } from '../campaign-specs/lib/types.js'

/** UTM convention from the design spec — funnels persist these into leadMetaJSON. */
export function buildAdLink(spec: CampaignSpec, ad: AdSpec): string {
  const url = new URL(spec.landingBaseUrl)
  url.searchParams.set('utm_source', 'meta')
  url.searchParams.set('utm_medium', 'paid')
  url.searchParams.set('utm_campaign', spec.key)
  url.searchParams.set('utm_content', ad.key)
  return url.toString()
}
