'use client'

import { useEffect, useState } from 'react'

const SPLASH_SESSION_KEY = 'pwa-splash-shown'
// Minimum on-screen time so the splash never flickers; max cap so a slow
// launch can never trap the user behind it. Dismissal fires at the later of
// (first paint after hydration) and MIN, or at MAX, whichever comes first.
const MIN_VISIBLE_MS = 900
const MAX_VISIBLE_MS = 8000

/**
 * Returns whether the splash should be dismissed (faded out). Starts false so
 * the overlay is present in the initial (SSR) paint — the CSS gate shows it
 * only in standalone. Flips true when the app is ready (or at the cap).
 */
export function useSplashDismissed(): boolean {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (!standalone || sessionStorage.getItem(SPLASH_SESSION_KEY)) {
      // Browser, or already shown this session → remove without a splash.
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setDismissed(true)
      return
    }
    sessionStorage.setItem(SPLASH_SESSION_KEY, '1')

    const start = performance.now()
    let done = false
    const finish = () => {
      if (done) {
        return
      }
      done = true
      const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start))
      window.setTimeout(() => setDismissed(true), wait)
    }

    const cap = window.setTimeout(finish, MAX_VISIBLE_MS)
    // "Ready" ≈ the first paint after hydration (two RAFs). For the current
    // static overview this is near-immediate, so MIN_VISIBLE_MS dominates.
    const raf = requestAnimationFrame(() => requestAnimationFrame(finish))

    return () => {
      window.clearTimeout(cap)
      cancelAnimationFrame(raf)
    }
  }, [])

  return dismissed
}
