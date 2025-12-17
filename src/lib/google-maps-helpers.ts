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
