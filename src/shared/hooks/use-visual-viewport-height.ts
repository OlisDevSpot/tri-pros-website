'use client'

import { useCallback, useSyncExternalStore } from 'react'

// iOS keeps `dvh` at the full screen while the keyboard is up; the visual viewport is the part left visible above
// it. Subscribes only while `enabled`, so a surface that is usually closed adds no listener until it opens.
export function useVisualViewportHeight(enabled: boolean): number | null {
  const subscribe = useCallback((onChange: () => void) => {
    const viewport = enabled ? window.visualViewport : null
    viewport?.addEventListener('resize', onChange)
    return () => viewport?.removeEventListener('resize', onChange)
  }, [enabled])

  return useSyncExternalStore(
    subscribe,
    () => (enabled && window.visualViewport ? Math.round(window.visualViewport.height) : null),
    () => null,
  )
}
