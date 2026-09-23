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

interface UseSessionOnceOptions {
  /**
   * Render it open on the server, so the first paint carries it (E9). The server cannot read
   * the tab's store, so a caller that opts in accepts one fade on a hard reload after the
   * dismissal. Default false: closed until the client has read the store.
   */
  openOnServer?: boolean
}

/**
 * Show something once per browser session, from the very first render (spec C §12 S15, E9).
 * The store is `sessionStorage` under `key`, read synchronously through `useSyncExternalStore`.
 * A caller that opts into `openOnServer` is open in the HTML and the client's own answer takes
 * over after hydration; every other caller is closed until then, exactly as before. `dismiss`
 * writes the key and closes; the key is written on
 * dismiss, not on show, so a reload before the dismissal shows it again (S15). Whether to show at
 * all is the caller's policy: a primitive never decides to appear. An unavailable store (blocked
 * site data, a partitioned iframe, iOS quota 0) fails open — it shows, and it still closes,
 * because a dismissal is also remembered in memory for the life of the page. Every caller of the
 * same key sees the same `open`: the store is shared, so a component that renders the splash and
 * another that goes inert under it need no context between them.
 */
export function useSessionOnce(key: string, enabled: boolean, { openOnServer = false }: UseSessionOnceOptions = {}): [open: boolean, dismiss: () => void] {
  const unseen = useSyncExternalStore(subscribe, () => isUnseen(key), () => openOnServer)

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
