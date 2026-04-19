/**
 * PWA / standalone-display helpers.
 *
 * The same hostname behaves very differently depending on where it's loaded:
 * a click to https://maps.google.com from a browser tab wants a new tab,
 * but from an iOS standalone PWA it should route through the OS so iOS can
 * hand the URL to the Google Maps app via universal links.
 */

/**
 * True when the app is running as an installed PWA in standalone mode.
 *
 * Checks both the CSS media query (Android / desktop Chrome) and the
 * Safari-specific `navigator.standalone` flag (iOS). SSR-safe — returns
 * false on the server so the caller can rely on it during render.
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

/**
 * Open an external URL, picking the right strategy for the current runtime.
 *
 * - In a browser tab: opens in a new tab so the user's current context
 *   (our app) is preserved.
 * - In an installed PWA (iOS/Android standalone): uses `location.href` so
 *   the OS can route the navigation through its universal-link handler
 *   (e.g. https://maps.google.com/... opens the Google Maps app directly).
 *   Using `window.open('_blank')` in standalone mode creates a blank
 *   internal window that lingers in the PWA after the OS hands off to the
 *   native app — bad UX. `location.href` lets iOS intercept cleanly.
 *
 * Fallback behaviour in the rare case a universal link doesn't match: the
 * PWA will navigate to the URL in-window; the user can swipe-back to return.
 */
export function openExternalUrl(url: string): void {
  if (typeof window === 'undefined') {
    return
  }
  if (isStandalonePWA()) {
    window.location.href = url
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
