'use client'

import { useEffect } from 'react'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'
import { requestShellRevalidation } from '@/shared/domains/pwa/lib/register-service-worker'

/**
 * Mounted in the dashboard layout outside its Suspense slots, so it fires on the layout's first commit:
 * the server has answered and its sidebar frame and route skeleton have painted under the cover. The
 * session and the page fill in afterwards behind a visible skeleton, as on any document load. A no-op
 * on every document that is not a launch. After a shell launch it also asks the worker for a fresh
 * shell: on Chrome the launch is answered without the worker running, so this is the only time it
 * hears about one.
 */
export function PwaLaunchReady() {
  useEffect(() => {
    const shellLaunch = pwaLaunch.wasShellLaunch()
    pwaLaunch.ready()
    if (shellLaunch) {
      requestShellRevalidation()
    }
  }, [])
  return null
}
