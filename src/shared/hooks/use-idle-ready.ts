'use client'

import { useEffect, useState } from 'react'

export function useIdleReady(): boolean {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => setIsReady(true), { timeout: 3000 })
      return () => window.cancelIdleCallback(handle)
    }
    const handle = window.setTimeout(() => setIsReady(true), 1500)
    return () => window.clearTimeout(handle)
  }, [])
  return isReady
}
