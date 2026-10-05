'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSidebar } from '@/shared/components/ui/sidebar'

/**
 * Present mode is the browser's own fullscreen (the F11 action) plus the app
 * sidebar collapsed to icons through the shadcn provider's `setOpen`.
 *
 * `presenting` mirrors `document.fullscreenElement`, so leaving fullscreen by
 * any route (Esc, F11, the capsule toggle, `exit()`) re-opens the sidebar and
 * the state follows. `setOpen` also writes the `sidebar_state` cookie
 * (accepted, spec §2). Platforms without the Fullscreen API (iPhone Safari)
 * cannot present; `toggle` is a no-op there.
 */
export function usePresentMode() {
  const { setOpen } = useSidebar()
  const [presenting, setPresenting] = useState(false)

  useEffect(() => {
    function onFullscreenChange() {
      const active = document.fullscreenElement !== null
      setPresenting(active)
      setOpen(!active)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [setOpen])

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    else if (typeof document.documentElement.requestFullscreen === 'function') {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [])

  return { presenting, toggle, exit }
}
