import { SERVICE_AREA_ZIPS } from './service-area-zips'

/**
 * True when a 5-digit US ZIP is inside the Tri Pros service area (LA / San
 * Bernardino / Riverside / Ventura counties whole, Orange County north of Laguna
 * Beach, plus Rosamond). Pure, O(1), no network — the canonical service-area
 * gate. Membership data is generated (see service-area-zips.ts).
 */
export function isInServiceArea(zip: string): boolean {
  return SERVICE_AREA_ZIPS.has(zip)
}
