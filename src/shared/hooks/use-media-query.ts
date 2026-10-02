'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Reads the query during render, so a component that mounts client-side (a dialog opened on a
// click) gets the right answer on its first render instead of rendering the wrong layout and
// correcting in an effect. During hydration React uses the server snapshot, so markup matches.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
