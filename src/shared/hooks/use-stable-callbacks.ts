'use client'

import { useLayoutEffect, useRef, useState } from 'react'

import { hasSameValues, withLatestCallbacks } from '@/shared/lib/stable-callbacks'

/**
 * `value` (an object, or an array of objects) with stable function entries that call the latest
 * committed render's version, keeping its identity until a non-function entry changes. For values
 * whose identity drives re-renders, like table meta and row action configs. A function called while
 * rendering runs the previous commit's closure, so such functions must depend only on their arguments.
 */
export function useStableCallbacks<T extends object>(value: T): T {
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  })
  const [snapshot, setSnapshot] = useState(() => ({ source: value, stable: withLatestCallbacks(value, () => latest.current) }))
  if (!hasSameValues(snapshot.source, value)) {
    const next = { source: value, stable: withLatestCallbacks(value, () => latest.current) }
    setSnapshot(next)
    return next.stable
  }
  return snapshot.stable
}
