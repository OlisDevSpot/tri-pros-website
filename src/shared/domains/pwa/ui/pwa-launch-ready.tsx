'use client'

import { useEffect } from 'react'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'
import { requestShellRevalidation } from '@/shared/domains/pwa/lib/register-service-worker'

/**
 * Mounted in the dashboard layout outside its Suspense slots, so it fires on the layout's first commit:
 * the server has answered and its sidebar frame and route skeleton have painted under the cover. The
 * session and the page fill in afterwards behind a visible skeleton, as on any document load. `ready`
 * is a no-op on every document that is not a launch.
 *
 * The shell revalidation is asked for on every dashboard document, not only after a shell launch: on
 * Chrome the launch is answered from Cache Storage without the worker running, and after a deploy the
 * stale shell hard-loads before its own dashboard commits, so a plain dashboard load is the only moment
 * the worker can learn that the shell is stale. The worker fetches the static shell once and writes
 * nothing when it is unchanged; without a controlling worker the message is not sent.
 */
export function PwaLaunchReady() {
  useEffect(() => {
    pwaLaunch.ready()
    requestShellRevalidation()
  }, [])
  return null
}
