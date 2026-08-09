'use client'

import { useEffect, useState } from 'react'

const SESSION_KEY = 'pwa-launch-shown'
// Small floor so the fade reads as a graceful settle, not an instant flash;
// the cover otherwise dismisses the moment the app is ready.
const MIN_VISIBLE_MS = 400
const FADE_MS = 300

/**
 * Installed-PWA launch cover: a STATIC logo on #09090b that continues seamlessly
 * from the native iOS startup image (same mark, same color) and fades out the
 * instant the app is ready. Rendered in the initial SSR HTML and CSS-gated to
 * `display-mode: standalone` (see `.pwa-launch` in globals.css), so it paints
 * from the first frame in the installed PWA and never shows in a browser. No
 * animation, no fixed long timer, no service worker — the native startup image
 * can't fade itself, so this web-view layer provides the fade to the dashboard.
 */
export function PwaLaunchScreen() {
  const [ready, setReady] = useState(false)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (!standalone || sessionStorage.getItem(SESSION_KEY)) {
      // Browser (CSS also hides it), or already shown this session → drop it.
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setRemoved(true)
      return
    }
    sessionStorage.setItem(SESSION_KEY, '1')

    const start = performance.now()
    let fadeTimer = 0
    let removeTimer = 0
    // "Ready" ≈ the first paint after hydration (two RAFs), honoring the floor.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start))
        fadeTimer = window.setTimeout(() => {
          setReady(true)
          removeTimer = window.setTimeout(() => setRemoved(true), FADE_MS)
        }, wait)
      }),
    )

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(fadeTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  if (removed) {
    return null
  }

  return (
    <div className="pwa-launch" data-ready={ready} aria-hidden>
      <img src="/company/logo/logo-dark.svg" alt="" className="pwa-launch-logo" />
    </div>
  )
}
