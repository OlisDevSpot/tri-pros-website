'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/shared/hooks/use-debounce'

export function useDebouncedSave<T>(value: T, stored: T, save: (value: T) => void, delayMs = 600) {
  const debounced = useDebounce(value, delayMs)
  const latest = useRef({ value, stored, save })
  // A flush on hide and the debounce catching up later must not send the same value twice.
  const lastSent = useRef<{ value: T } | null>(null)

  useEffect(() => {
    latest.current = { value, stored, save }
  })

  useEffect(() => {
    const { stored: s, save: write } = latest.current
    if (Object.is(debounced, s)) {
      // Back at the stored value (a save landed, or a failed one was reverted), so the same pick may be sent again.
      lastSent.current = null
      return
    }
    if (lastSent.current && Object.is(lastSent.current.value, debounced)) {
      return
    }
    lastSent.current = { value: debounced }
    write(debounced)
  }, [debounced])

  useEffect(() => {
    function flush() {
      const { value: v, stored: s, save: write } = latest.current
      if (Object.is(v, s) || (lastSent.current && Object.is(lastSent.current.value, v))) {
        return
      }
      lastSent.current = { value: v }
      write(v)
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flush()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
    }
  }, [])
}
