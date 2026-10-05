'use client'

import { useEffect, useRef } from 'react'

/**
 * Keeps the active item of a horizontal strip in view. The strip must be the items' offset parent
 * (`position: relative`). scrollIntoView would also scroll the step and the dashboard around it.
 */
export function useScrollStripToActive<Strip extends HTMLElement, Item extends HTMLElement>(activeIndex: number, items: readonly unknown[]) {
  const stripRef = useRef<Strip>(null)
  const activeRef = useRef<Item>(null)

  useEffect(() => {
    const strip = stripRef.current
    const active = activeRef.current
    if (!strip || !active) {
      return
    }
    const start = active.offsetLeft
    const end = start + active.offsetWidth
    if (start < strip.scrollLeft) {
      strip.scrollLeft = start
    }
    else if (end > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = end - strip.clientWidth
    }
  }, [activeIndex, items])

  return { stripRef, activeRef }
}
