'use client'

import { useEffect, useState } from 'react'
import { PwaSplashOverlay } from '@/shared/components/splash-screen/pwa-splash-overlay'
import { useSplashDismissed } from '@/shared/components/splash-screen/use-splash-dismissed'

export function PwaSplashScreen() {
  const dismissed = useSplashDismissed()
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    if (!dismissed) {
      return
    }
    // Unmount after the 300ms opacity fade (see .pwa-splash-overlay CSS).
    const t = window.setTimeout(() => setRemoved(true), 350)
    return () => window.clearTimeout(t)
  }, [dismissed])

  if (removed) {
    return null
  }
  return <PwaSplashOverlay hidden={dismissed} />
}
