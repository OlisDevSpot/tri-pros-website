'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Keys dismissed in this page's lifetime: a dismissal closes even when the store throws. */
const dismissedInMemory = new Set<string>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isUnseen(key: string): boolean {
  if (dismissedInMemory.has(key)) {
    return false
  }
  try {
    return sessionStorage.getItem(key) === null
  }
  catch {
    // storage unavailable: nothing is remembered, so it shows (fail open)
    return true
  }
}

/** The server cannot read the tab's store; it answers "unseen" so the first paint carries the splash (E9). */
function unseenOnServer(): boolean {
  return true
}

/**
 * Show something once per browser session, from the very first render (spec C §12 S15, E9).
 * The store is `sessionStorage` under `key`, read synchronously through `useSyncExternalStore`,
 * so a server-rendered caller is open in the HTML and the client's own answer takes over after
 * hydration: a splash already dismissed in this tab then closes (a hard reload after the press
 * shows it for one fade — accepted). `dismiss` writes the key and closes; the key is written on
 * dismiss, not on show, so a reload before the dismissal shows it again (S15). Whether to show at
 * all is the caller's policy: a primitive never decides to appear. An unavailable store (blocked
 * site data, a partitioned iframe, iOS quota 0) fails open — it shows, and it still closes,
 * because a dismissal is also remembered in memory for the life of the page. Every caller of the
 * same key sees the same `open`: the store is shared, so a component that renders the splash and
 * another that goes inert under it need no context between them.
 */
export function useSessionOnce(key: string, enabled: boolean): [open: boolean, dismiss: () => void] {
  const unseen = useSyncExternalStore(subscribe, () => isUnseen(key), unseenOnServer)

  const dismiss = useCallback(() => {
    dismissedInMemory.add(key)
    try {
      sessionStorage.setItem(key, '1')
    }
    catch {
      // storage unavailable: remembered in memory only; shows again next load
    }
    for (const listener of listeners) {
      listener()
    }
  }, [key])

  return [enabled && unseen, dismiss]
}
