'use client'

import { useLayoutEffect, useRef } from 'react'

import { hasSameValues, withLatestCallbacks } from '@/shared/lib/stable-callbacks'

/**
 * `value` (an object, or an array of objects) with stable function entries that call the latest
 * committed render's version. The result keeps its identity while every non-function entry is the
 * same by `Object.is`; a non-function entry that is new on every render (`data ?? []`, an inline
 * `.map`) costs a new identity each render, so its consumers re-render. A function called while
 * rendering runs the previous commit's closure, so such functions must depend only on their arguments.
 */
export function useStableCallbacks<T extends object>(value: T): T {
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  })
  // A ref, not state: a state update during render re-runs the caller, which rebuilds `value`, so a
  // value that is new on every render would loop until React throws "Too many re-renders".
  const snapshot = useRef<{ source: T, stable: T } | null>(null)
  if (snapshot.current === null || !hasSameValues(snapshot.current.source, value)) {
    snapshot.current = { source: value, stable: withLatestCallbacks(value, () => latest.current) }
  }
  return snapshot.current.stable
}
