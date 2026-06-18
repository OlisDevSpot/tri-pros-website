import { CA_ZIP_CITIES } from '@/shared/domains/funnels/constants/ca-zip-cities'

export interface ResolvedZip {
  zip: string
  city: string
  state: string
  county: string | null
}

export async function resolveZip(zip: string): Promise<ResolvedZip | null> {
  const local = CA_ZIP_CITIES[zip]
  if (local) {
    return { zip, city: local.city, state: 'CA', county: local.county }
  }
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) {
      return null
    }
    const data = await res.json() as { places?: Array<{ 'place name': string, 'state abbreviation': string }> }
    const place = data.places?.[0]
    if (!place) {
      return null
    }
    return { zip, city: place['place name'], state: place['state abbreviation'], county: null }
  }
  catch {
    return null
  }
}

/** SoCal ZIP range ≈ 90001–93599 (LA / OC / SD / Inland Empire / Ventura). */
const SOCAL_ZIP = /^9[0-3]\d{3}$/

/**
 * Typo-prevention + light territory check (NOT a hard gate — we'd rather
 * qualify an adjacent SoCal homeowner than reject them):
 * - 'invalid-format'  → not a 5-digit SoCal-range ZIP; reject as a mistake.
 * - 'in-area'         → a known service-area ZIP, OR a SoCal-range ZIP we accept.
 * - 'out-of-area'     → reserved for future tightening (currently unused; SoCal
 *                       range all maps to 'in-area'). Kept for the not-qualified UI.
 */
export function classifyZip(zip: string): 'in-area' | 'out-of-area' | 'invalid-format' {
  if (!SOCAL_ZIP.test(zip)) {
    return 'invalid-format'
  }
  return 'in-area'
}
