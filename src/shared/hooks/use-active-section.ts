'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { activeSectionAt, isScrolledToBottom, trackingLine } from '@/shared/lib/active-section'

interface Options {
  rootEl: HTMLElement | null
  /** Pixels at the root's top that sticky chrome covers. */
  offset?: number
  /** Where the line sits in the visible rest of the root, 0 at its top. */
  ratio?: number
}

const SCROLL_IDLE_MS = 150
const FALLBACK_RELEASE_MS = 1000
// A long smooth jump on a phone can run past a second; this only covers a scrollend that never fires.
const SCROLLEND_SAFETY_RELEASE_MS = 3000
const GRAB_EVENTS = ['pointerdown', 'wheel', 'touchstart'] as const

export function useActiveSection(sectionIds: readonly string[], { rootEl, offset = 0, ratio = 0.3 }: Options) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '')
  const lockRef = useRef(false)
  const measureRef = useRef<() => void>(() => {})
  const releaseRef = useRef<(() => void) | null>(null)
  const idsKey = sectionIds.join('|')

  useEffect(() => {
    if (!rootEl) {
      return
    }
    const ids = idsKey.split('|').filter(Boolean)
    let frame = 0
    const measure = () => {
      frame = 0
      if (lockRef.current) {
        return
      }
      const line = trackingLine({ rootTop: rootEl.getBoundingClientRect().top, clientHeight: rootEl.clientHeight, offset, ratio })
      const sections = ids.map(id => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top ?? null }))
      const next = activeSectionAt(sections, line, isScrolledToBottom(rootEl))
      setActiveId(prev => (prev === next ? prev : next))
    }
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(measure)
      }
    }
    measureRef.current = measure
    frame = requestAnimationFrame(measure)
    rootEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      rootEl.removeEventListener('scroll', onScroll)
      if (frame) {
        cancelAnimationFrame(frame)
      }
    }
  }, [rootEl, idsKey, offset, ratio])

  useEffect(() => () => releaseRef.current?.(), [rootEl])

  // A tap marks its section at once and holds it until the scroll it starts has ended, so the sections it passes on
  // the way never flash active. A grab by the reader releases it. Any element id may be a target (a part card in a
  // chapter); only a tracked id is marked, and the release measures, so the section the target sits in wins.
  const select = useCallback((id: string) => {
    const target = document.getElementById(id)
    if (!rootEl || !target) {
      return
    }
    const root = rootEl
    releaseRef.current?.()
    lockRef.current = true
    if (idsKey.split('|').includes(id)) {
      setActiveId(id)
    }
    // Typed as always present, but undefined where the browser lacks the event.
    const hasScrollEnd = root.onscrollend !== undefined
    let idle = 0
    let timeout = 0
    function release() {
      releaseRef.current = null
      lockRef.current = false
      measureRef.current()
      window.clearTimeout(idle)
      window.clearTimeout(timeout)
      root.removeEventListener('scrollend', release)
      root.removeEventListener('scroll', onIdleScroll)
      for (const type of GRAB_EVENTS) {
        root.removeEventListener(type, release)
      }
    }
    function onIdleScroll() {
      window.clearTimeout(idle)
      idle = window.setTimeout(release, SCROLL_IDLE_MS)
    }
    timeout = window.setTimeout(release, hasScrollEnd ? SCROLLEND_SAFETY_RELEASE_MS : FALLBACK_RELEASE_MS)
    if (hasScrollEnd) {
      root.addEventListener('scrollend', release)
    }
    else {
      root.addEventListener('scroll', onIdleScroll, { passive: true })
    }
    for (const type of GRAB_EVENTS) {
      root.addEventListener(type, release, { passive: true })
    }
    releaseRef.current = release
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }, [rootEl, idsKey])

  return { activeId, select }
}
