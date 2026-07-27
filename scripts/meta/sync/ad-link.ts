/**
 * Creative `url_tags` value (query string, NO leading '?') — the API twin of
 * Ads Manager's "URL parameters" (Tracking) input. Meta appends these to the
 * destination link at delivery, so the link itself stays clean.
 * Funnels persist these params into leadMetaJSON.
 */
export function buildUrlTags(campaignKey: string, adKey: string): string {
  return new URLSearchParams({
    utm_source: 'meta',
    utm_medium: 'paid',
    utm_campaign: campaignKey,
    utm_content: adKey,
  }).toString()
}
