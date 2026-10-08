'use client'

import { useEffect } from 'react'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'

/**
 * Mounted in the dashboard layout outside its Suspense slots, so it fires on the layout's first commit:
 * the server has answered and its sidebar frame and route skeleton have painted under the cover. The
 * session and the page fill in afterwards behind a visible skeleton, as on any document load. A no-op
 * on every document that is not a launch.
 */
export function PwaLaunchReady() {
  useEffect(() => {
    pwaLaunch.ready()
  }, [])
  return null
}
