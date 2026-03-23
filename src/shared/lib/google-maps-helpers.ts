export function extractPart(place: google.maps.places.PlaceResult, type: string, { short = false } = {}) {
  if (!place.address_components) {
    return ''
  }

  if (type === 'city') {
    return getCityName(place.address_components)
  }

  const partObj = place.address_components?.find(c => c.types.includes(type)) ?? ''

  if (!partObj) {
    return ''
  }

  if (short) {
    return partObj.short_name
  }

  return partObj.long_name
}

function getCityName(addressComponents: google.maps.GeocoderAddressComponent[]) {
  const locality = addressComponents.find(c => c.types.includes('locality'))
  const neighborhood = addressComponents.find(c => c.types.includes('neighborhood'))
  const sublocality = addressComponents.find(c => c.types.includes('sublocality'))

  if (locality && locality.long_name !== 'Los Angeles') {
    return locality.long_name
  }

  if (locality && locality.long_name === 'Los Angeles' && neighborhood) {
    return neighborhood.long_name
  }

  if (sublocality) {
    return sublocality.long_name
  }

  return locality ? locality.long_name : ''
}

export interface LatLng {
  lat: number
  lng: number
}

export interface AddressFields {
  address: string
  city: string
  state: string
  zip: string
  fullAddress: string
  location: LatLng | null
}

export function parseAddressComponents(place: google.maps.places.PlaceResult): AddressFields {
  const components = place.address_components ?? []

  const get = (type: string) =>
    components.find(c => c.types.includes(type))?.long_name ?? ''
  const getShort = (type: string) =>
    components.find(c => c.types.includes(type))?.short_name ?? ''

  const streetNumber = get('street_number')
  const route = get('route')
  const address = [streetNumber, route].filter(Boolean).join(' ')
  const city = getCityName(components)
  const state = getShort('administrative_area_level_1')
  const zip = get('postal_code')
  const fullAddress = place.formatted_address ?? [address, city, state].filter(Boolean).join(', ')
  const location = place.geometry?.location
    ? { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
    : null

  return { address, city, state, zip, fullAddress, location }
}
