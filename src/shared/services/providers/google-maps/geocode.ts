import env from '@/shared/config/server-env'

import 'server-only'

export interface GeocodeResult {
  latitude: number
  longitude: number
}

interface GoogleGeocodeResponse {
  status: string
  error_message?: string
  results: Array<{
    geometry: {
      location: { lat: number, lng: number }
    }
  }>
}

async function geocodeOne(address: string, key: string): Promise<{ ok: true, result: GeocodeResult } | { ok: false, reason: string }> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address)
  url.searchParams.set('key', key)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as GoogleGeocodeResponse
    if (data.status !== 'OK' || !data.results.length) {
      const extra = data.error_message ? ` — ${data.error_message}` : ''
      return { ok: false, reason: `Google ${data.status}${extra}` }
    }

    const location = data.results[0]?.geometry.location
    if (!location) {
      return { ok: false, reason: 'No location in response' }
    }
    return { ok: true, result: { latitude: location.lat, longitude: location.lng } }
  }
  catch (err) {
    return { ok: false, reason: `fetch failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// Tries each candidate in order and returns the first successful geocode.
// Logs every attempt so the Next.js dev server terminal reveals exactly what
// broke (missing key, Google error, network failure, etc.).
export async function geocodeAddress(candidates: string | string[]): Promise<GeocodeResult | null> {
  const key = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.error('[geocode] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing on the server. Check your .env and restart the dev server.')
    return null
  }

  const queries = (Array.isArray(candidates) ? candidates : [candidates])
    .map(c => c.trim())
    .filter(c => c.length > 0)

  if (queries.length === 0) {
    console.warn('[geocode] No non-empty candidates to geocode.')
    return null
  }

  for (const query of queries) {
    const outcome = await geocodeOne(query, key)
    if (outcome.ok) {
      console.warn(`[geocode] ✅ matched "${query}" → ${outcome.result.latitude},${outcome.result.longitude}`)
      return outcome.result
    }
    console.warn(`[geocode] ✗ "${query}" — ${outcome.reason}`)
  }
  console.warn(`[geocode] Exhausted all candidates with no match: ${JSON.stringify(queries)}`)
  return null
}
