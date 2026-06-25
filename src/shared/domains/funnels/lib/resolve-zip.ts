import { isInServiceArea } from '@/shared/constants/company/service-area'
import { SERVICE_AREA_CITIES } from '@/shared/constants/company/service-area-cities'

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
  const local = SERVICE_AREA_CITIES[zip]
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

/**
 * Territory gate for the funnel ZIP step:
 * - 'invalid-format' → not a 5-digit ZIP (a typo); neutral, no message.
 * - 'in-area'        → inside the Tri Pros service area (resolve city for badge).
 * - 'out-of-area'    → a real-looking ZIP we don't serve; the step shows the
 *                      out-of-area message and keeps the advance button disabled.
 * Local + synchronous — no API call to decide service area.
 */
export function classifyZip(zip: string): 'in-area' | 'out-of-area' | 'invalid-format' {
  if (!/^\d{5}$/.test(zip)) {
    return 'invalid-format'
  }
  return isInServiceArea(zip) ? 'in-area' : 'out-of-area'
}
