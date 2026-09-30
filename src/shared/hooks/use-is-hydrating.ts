'use client'

import { useSyncExternalStore } from 'react'

function subscribe() {
  return () => {}
}

/**
 * True while React renders this component from server HTML (the server render and its
 * hydration), false when it mounts client-side (a soft navigation, a later interaction).
 * React reads the server snapshot during hydration, so the answer matches the HTML and never
 * causes a hydration mismatch.
 *
 * Use it to skip an entrance animation that would hide server-rendered content:
 * `initial={isHydrating ? false : { opacity: 0 }}`. Motion writes `initial` into the server
 * HTML as an inline style, so an opacity-0 entrance keeps the first paint (skeletons included)
 * invisible until the JS has loaded. Motion reads `initial` only on mount, so the re-render after
 * hydration does not replay anything.
 */
export function useIsHydrating(): boolean {
  return useSyncExternalStore(subscribe, () => false, () => true)
}
