'use client'

import { useEffect } from 'react'

// Registers the service worker as early as possible so it is active in time
// to serve the app-shell on the NEXT cold launch. The push hook also calls
// register('/sw.js'); registering the same script URL twice is idempotent.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] eager registration failed:', err)
    })
  }, [])

  return null
}
