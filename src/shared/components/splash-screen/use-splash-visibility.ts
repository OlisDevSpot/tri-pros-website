'use client'

import { useEffect, useState } from 'react'

const SPLASH_SESSION_KEY = 'app-splash-shown'
const SPLASH_VISIBLE_MS = 2000

export function useSplashVisibility(shouldShow: boolean) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!shouldShow) {
      return
    }
    if (sessionStorage.getItem(SPLASH_SESSION_KEY)) {
      return
    }
    sessionStorage.setItem(SPLASH_SESSION_KEY, '1')
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setVisible(true)
  }, [shouldShow])

  useEffect(() => {
    if (!visible) {
      return
    }
    const timer = setTimeout(() => setVisible(false), SPLASH_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [visible])

  return visible
}
