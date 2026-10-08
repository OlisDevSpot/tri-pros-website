'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROOTS } from '@/shared/config/roots'
import { PWA_LAUNCH_STALL_MS } from '@/shared/domains/pwa/constants/launch'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'

declare global {
  interface Window {
    /** Set before the shell navigates, so the document's own watchdog knows the bundle ran. */
    __tprLaunch?: true
  }
}

/**
 * The shell's only job: mark the launch so the cover stays up, then move to the dashboard in the same
 * document. If this component is still mounted when the stall bound passes, the soft navigation has
 * failed and a hard load of the unmarked dashboard takes over — the one hard load on the launch path.
 */
export function PwaLaunchHandoff() {
  const router = useRouter()

  useEffect(() => {
    window.__tprLaunch = true
    pwaLaunch.begin()
    router.replace(ROOTS.dashboard.root)
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace(ROOTS.dashboard.root), PWA_LAUNCH_STALL_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return null
}
