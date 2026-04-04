'use client'

import { useCallback, useState } from 'react'

/**
 * useState backed by localStorage. Reads initial value from storage,
 * writes on every setState. Falls back to `defaultValue` on SSR or storage errors.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        return JSON.parse(stored) as T
      }
    }
    catch {
      // SSR or parse error
    }
    return defaultValue
  })

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateRaw((prev) => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      try {
        localStorage.setItem(key, JSON.stringify(next))
      }
      catch {
        // Storage full or unavailable
      }
      return next
    })
  }, [key])

  return [state, setState]
}
