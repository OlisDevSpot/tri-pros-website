/**
 * Browser Pixel surface. Nobody calls raw `fbq` — they call firePixel(). The
 * loader (pixel-loader.tsx) defines window.fbq; this wrapper is a no-op until
 * it exists, so calls before load (or when the pixel is unconfigured) are safe.
 */

interface Fbq {
  (...args: unknown[]): void
}
declare global {
  interface Window {
    fbq?: Fbq
  }
}

/** Shared dedup id for a browser event and its server CAPI twin. */
export function mintEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for ancient browsers; randomUUID is universal on funnel targets.
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/** Read Meta's attribution cookies set by the pixel/click. */
export function readFbCookies(): { fbp: string | null, fbc: string | null } {
  if (typeof document === 'undefined') {
    return { fbp: null, fbc: null }
  }
  const read = (name: string): string | null => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  }
  return { fbp: read('_fbp'), fbc: read('_fbc') }
}

export function firePixel(
  event: string,
  params?: {
    eventId?: string
    contentCategory?: string
    contentName?: string
    custom?: Record<string, unknown>
  },
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return
  }
  const customData: Record<string, unknown> = { ...params?.custom }
  if (params?.contentCategory) {
    customData.content_category = params.contentCategory
  }
  if (params?.contentName) {
    customData.content_name = params.contentName
  }
  window.fbq(
    'track',
    event,
    customData,
    params?.eventId ? { eventID: params.eventId } : undefined,
  )
}
