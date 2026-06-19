import { CA_ZIP_CITIES } from '@/shared/domains/funnels/constants/ca-zip-cities'

export interface ResolvedZip {
  zip: string
  city: string
  state: string
  county: string | null
}

/**
 * Discriminated outcome of a live resolve. We must tell three cases apart so the
 * UI can react correctly:
 * - 'ok'        → resolved to a real place (badge).
 * - 'not-found' → the API definitively says this ZIP doesn't exist (404 / empty
 *                 places). A real, surfaceable error — distinct from a transient
 *                 failure so the hook can show "couldn't find that ZIP".
 * - 'error'     → transient/network failure (incl. aborts). Caller decides;
 *                 the hook deliberately treats this (and aborts) as "no badge,
 *                 no error message" so a cancelled request never flashes an error.
 */
export type ResolveZipResult
  = | { status: 'ok', data: ResolvedZip }
    | { status: 'not-found' }
    | { status: 'error' }

export async function resolveZip(zip: string, opts?: { signal?: AbortSignal }): Promise<ResolveZipResult> {
  const local = CA_ZIP_CITIES[zip]
  if (local) {
    return { status: 'ok', data: { zip, city: local.city, state: 'CA', county: local.county } }
  }
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: opts?.signal })
    // zippopotam returns 404 for a non-existent ZIP — a definitive "not found".
    if (res.status === 404) {
      return { status: 'not-found' }
    }
    if (!res.ok) {
      return { status: 'error' }
    }
    const data = await res.json() as { places?: Array<{ 'place name': string, 'state abbreviation': string }> }
    const place = data.places?.[0]
    if (!place || !place['place name']) {
      return { status: 'not-found' }
    }
    return { status: 'ok', data: { zip, city: place['place name'], state: place['state abbreviation'], county: null } }
  }
  catch {
    // Aborts land here too — surfaced as 'error', which the hook treats as a
    // no-op (it also guards on signal.aborted before any setState).
    return { status: 'error' }
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
