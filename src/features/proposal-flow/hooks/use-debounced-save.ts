'use client'

import type { RefObject } from 'react'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/shared/hooks/use-debounce'

type Save<T> = (value: T, failed: () => void) => void

function send<T>(lastSent: RefObject<{ value: T } | null>, next: T, write: Save<T>) {
  const sent = { value: next }
  lastSent.current = sent
  write(next, () => {
    // Only the newest send is cleared, so an older failure can't reopen a value already superseded.
    if (lastSent.current === sent) {
      lastSent.current = null
    }
  })
}

// `save` gets a `failed` callback: calling it after a failed write lets the same value be sent again.
export function useDebouncedSave<T>(value: T, stored: T, save: Save<T>, delayMs = 600) {
  const debounced = useDebounce(value, delayMs)
  const latest = useRef({ value, stored, save })
  // A flush on hide and the debounce catching up later must not send the same value twice.
  const lastSent = useRef<{ value: T } | null>(null)

  useEffect(() => {
    latest.current = { value, stored, save }
  })

  // Re-run when the stored value moves too: a save that lands after a newer pick was compared against the old value.
  useEffect(() => {
    if (Object.is(debounced, stored)) {
      // Back at the stored value (a save landed, or a failed one was reverted), so the same pick may be sent again.
      lastSent.current = null
      return
    }
    if (lastSent.current && Object.is(lastSent.current.value, debounced)) {
      return
    }
    send(lastSent, debounced, latest.current.save)
  }, [debounced, stored])

  useEffect(() => {
    function flush() {
      const { value: v, stored: s, save: write } = latest.current
      if (Object.is(v, s) || (lastSent.current && Object.is(lastSent.current.value, v))) {
        return
      }
      send(lastSent, v, write)
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
