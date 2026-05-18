// Client-safe helpers that build Google Static Maps / Street View image URLs.
//
// The Static Maps and Street View Static APIs both accept either a
// lat/lng pair OR a plain address string as the center/location param.
// Passing the address directly lets Google's internal geocoding handle
// resolution — no separate Geocoding API call is needed.
//
// Reference:
//   https://developers.google.com/maps/documentation/maps-static/start#location-parameters
//   https://developers.google.com/maps/documentation/streetview/intro#URL_Parameters

/* eslint-disable node/prefer-global/process */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export function buildAerialStaticMapUrl(address: string, size = '640x300'): string {
  const params = new URLSearchParams({
    center: address,
    zoom: '19',
    size,
    scale: '2',
    maptype: 'hybrid',
    key: KEY,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

export function buildRoadmapStaticMapUrl(address: string, size = '640x300'): string {
  const params = new URLSearchParams({
    center: address,
    zoom: '16',
    size,
    scale: '2',
    maptype: 'roadmap',
    markers: `color:0xc4363c|${address}`,
    key: KEY,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

export function buildStreetViewStaticUrl(address: string, size = '640x300'): string {
  const params = new URLSearchParams({
    size,
    location: address,
    fov: '85',
    pitch: '0',
    scale: '2',
    source: 'outdoor',
    key: KEY,
  })
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`
}

export function buildGoogleMapsDeepLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function hasGoogleMapsKey(): boolean {
  return KEY.length > 0
}
