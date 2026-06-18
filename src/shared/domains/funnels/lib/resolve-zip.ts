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
