'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Show something once per browser session. `open` turns true, in an effect, when `enabled` and
 * `sessionStorage` holds nothing under `key`; `dismiss` writes the key and closes. The key is
 * written on dismiss, not on show, so a reload before the dismissal shows it again (spec C §12
 * S15). Whether to show at all is the caller's policy: a primitive never decides to appear. An
 * unavailable store (blocked site data, a partitioned iframe, iOS quota 0) fails open: the splash
 * still shows and still closes normally, it is simply not remembered across the session.
 */
export function useSessionOnce(key: string, enabled: boolean): [open: boolean, dismiss: () => void] {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alreadyShown = false
    try {
      alreadyShown = sessionStorage.getItem(key) !== null
    }
    catch {
      // storage unavailable: treat as nothing stored, show it
    }
    if (!enabled || alreadyShown) {
      return
    }
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setOpen(true)
  }, [enabled, key])

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(key, '1')
    }
    catch {
      // storage unavailable: show it again next time
    }
    setOpen(false)
  }, [key])

  return [open, dismiss]
}
