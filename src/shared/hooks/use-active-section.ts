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
// Only a jump that never starts (its target already in place) waits this long; a running jump is never cut short by it.
const JUMP_START_TIMEOUT_MS = 1000
// A long smooth jump on a phone can run past a second; this only covers an end that never arrives.
const JUMP_SAFETY_RELEASE_MS = 3000
// Scroll intent only: a press on a nav control inside the root is a tap, not a grab.
const GRAB_EVENTS = ['wheel', 'touchmove'] as const

export function useActiveSection(sectionIds: readonly string[], { rootEl, offset = 0, ratio = 0.3 }: Options) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '')
  const lockRef = useRef(false)
  const measureRef = useRef<() => void>(() => {})
  const releaseRef = useRef<((measure?: boolean) => void) | null>(null)
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

  // The nodes may already be gone, so the cleanup does not measure.
  useEffect(() => () => releaseRef.current?.(false), [rootEl])

  // A tap marks its section at once and holds it until the scroll it starts has ended, so the sections it passes on
  // the way never flash active. A grab by the reader releases it. Any element id may be a target (a part card in a
  // chapter); the tracked section that holds it is marked, and the release measures.
  const select = useCallback((id: string) => {
    const target = document.getElementById(id)
    if (!rootEl || !target) {
      return
    }
    const root = rootEl
    releaseRef.current?.(false)
    lockRef.current = true
    const owner = idsKey.split('|').find(sectionId => sectionId === id || document.getElementById(sectionId)?.contains(target))
    if (owner) {
      setActiveId(owner)
    }
    // Typed as always present, but undefined where the browser lacks the event.
    const hasScrollEnd = root.onscrollend !== undefined
    // A scroll event from before the tap reports the position the tap found; only movement belongs to this jump.
    const startTop = root.scrollTop
    let started = false
    let idle = 0
    let endCheck = 0
    let timeout = window.setTimeout(release, JUMP_START_TIMEOUT_MS)
    function release(measure = true) {
      releaseRef.current = null
      lockRef.current = false
      window.clearTimeout(idle)
      window.clearTimeout(timeout)
      cancelAnimationFrame(endCheck)
      root.removeEventListener('scrollend', onScrollEnd)
      root.removeEventListener('scroll', onJumpScroll)
      root.removeEventListener('pointerdown', onPointerDown)
      for (const type of GRAB_EVENTS) {
        root.removeEventListener(type, onGrab)
      }
      if (measure) {
        measureRef.current()
      }
    }
    function onJumpScroll() {
      if (!started && root.scrollTop !== startTop) {
        started = true
        window.clearTimeout(timeout)
        timeout = window.setTimeout(release, JUMP_SAFETY_RELEASE_MS)
      }
      if (hasScrollEnd) {
        cancelAnimationFrame(endCheck)
      }
      else if (started) {
        window.clearTimeout(idle)
        idle = window.setTimeout(release, SCROLL_IDLE_MS)
      }
    }
    // A scrollend can belong to a scroll that ended in the frame of the tap, or to a jump this tap superseded. The
    // compositor starts a smooth jump a few frames late, so an end counts only after the jump has moved, and once two
    // frames pass with no scroll from it.
    function onScrollEnd() {
      if (!started) {
        return
      }
      cancelAnimationFrame(endCheck)
      endCheck = requestAnimationFrame(() => {
        endCheck = requestAnimationFrame(() => release())
      })
    }
    function onGrab() {
      release()
    }
    // On the root itself it is a scrollbar drag; on a child it may be the next tap on a nav control.
    function onPointerDown(event: PointerEvent) {
      if (event.target === root) {
        release()
      }
    }
    root.addEventListener('scroll', onJumpScroll, { passive: true })
    if (hasScrollEnd) {
      root.addEventListener('scrollend', onScrollEnd)
    }
    root.addEventListener('pointerdown', onPointerDown, { passive: true })
    for (const type of GRAB_EVENTS) {
      root.addEventListener(type, onGrab, { passive: true })
    }
    releaseRef.current = release
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }, [rootEl, idsKey])

  return { activeId, select }
}
