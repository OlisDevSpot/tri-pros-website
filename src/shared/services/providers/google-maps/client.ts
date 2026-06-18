/* eslint-disable node/prefer-global/process */

// ---------------------------------------------------------------------------
// googleMapsClient — the single, uniform entry point for Google Maps.
//
// Client-safe: builds Static Maps / Street View image URLs from a plain address
// string (Google's APIs geocode the address internally, so no Geocoding call is
// needed) and reports whether the public key is present. Consumers import THIS —
// never reach into provider internals.
//
// Reference:
//   https://developers.google.com/maps/documentation/maps-static/start#location-parameters
//   https://developers.google.com/maps/documentation/streetview/intro#URL_Parameters
// ---------------------------------------------------------------------------

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

function createGoogleMapsClient() {
  return {
    hasKey(): boolean {
      return KEY.length > 0
    },

    aerialStaticMapUrl(address: string, size = '640x300'): string {
      const params = new URLSearchParams({
        center: address,
        zoom: '19',
        size,
        scale: '2',
        maptype: 'hybrid',
        key: KEY,
      })
      return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
    },

    roadmapStaticMapUrl(address: string, size = '640x300'): string {
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
    },

    streetViewStaticUrl(address: string, size = '640x300'): string {
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
    },
  }
}

export type GoogleMapsClient = ReturnType<typeof createGoogleMapsClient>
export const googleMapsClient = createGoogleMapsClient()
