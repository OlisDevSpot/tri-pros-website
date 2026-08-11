'use client'

import type { RefObject } from 'react'

import { useEffect, useRef, useState } from 'react'

/** Pixels of (damped) pull past which release triggers a refresh. */
export const PULL_TO_REFRESH_THRESHOLD = 64
const MAX_PULL = 96
const RESISTANCE = 0.5
/** Retract/settle transition duration (ms) applied on release only. */
const RETRACT_MS = 220

interface PullToRefreshState {
  isRefreshing: boolean
}

/**
 * Standard pull-down-to-refresh, TOUCH ONLY.
 *
 * Performance: the per-frame pull distance is written to a CSS variable
 * (`--dt-pull`, plus `--dt-pull-ms` for the release transition) on the scroll
 * container via direct DOM writes, RAF-coalesced to one write per frame. It
 * does NOT call setState during the drag, so the (heavy) DataTable is never
 * re-rendered while pulling. React state is used only for `isRefreshing` —
 * toggled once when a refresh starts and once when it settles. The spacer row
 * reads `--dt-pull` for its height and the spinner's opacity, so the visual is
 * entirely CSS-driven.
 *
 * Engages only when the container is at the very top, the drag is downward and
 * predominantly vertical, and the gesture did not start on a column-resize
 * handle (`[data-resize-handle]`). No-op when `onRefresh` is undefined.
 *
 * See `docs/superpowers/specs/2026-08-11-records-table-refresh-design.md` §6.1.
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  onRefresh: (() => Promise<unknown> | void) | undefined,
): PullToRefreshState {
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Gesture bookkeeping in refs — zero re-renders during move tracking.
  const startY = useRef(0)
  const startX = useRef(0)
  const engaged = useRef(false)
  const pull = useRef(0)
  const rafId = useRef<number | null>(null)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const refreshingRef = useRef(false)
  refreshingRef.current = isRefreshing

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onRefresh) {
      return
    }

    function setPullVar(px: number, transitionMs = 0) {
      el!.style.setProperty('--dt-pull', String(px))
      el!.style.setProperty('--dt-pull-ms', `${transitionMs}ms`)
    }

    function handleTouchStart(e: TouchEvent) {
      if (refreshingRef.current) {
        return
      }
      const touch = e.touches[0]
      const target = e.target as HTMLElement | null
      // Engage only from the top, never from a resize handle.
      if (!touch || el!.scrollTop > 0 || target?.closest('[data-resize-handle]')) {
        engaged.current = false
        return
      }
      engaged.current = true
      startY.current = touch.clientY
      startX.current = touch.clientX
    }

    function handleTouchMove(e: TouchEvent) {
      if (!engaged.current || refreshingRef.current) {
        return
      }
      const touch = e.touches[0]
      if (!touch) {
        return
      }
      const dy = touch.clientY - startY.current
      const dx = touch.clientX - startX.current
      // Downward + predominantly vertical only; otherwise yield to native pan.
      if (dy <= 0 || Math.abs(dy) <= Math.abs(dx)) {
        engaged.current = false
        pull.current = 0
        setPullVar(0)
        return
      }
      e.preventDefault() // we own the pull — suppress native rubber-band/scroll
      pull.current = Math.min(dy * RESISTANCE, MAX_PULL)
      // Coalesce to one DOM write per frame — no React render on the hot path.
      if (rafId.current == null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null
          setPullVar(pull.current)
        })
      }
    }

    function handleTouchEnd() {
      if (!engaged.current) {
        return
      }
      engaged.current = false
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      if (pull.current >= PULL_TO_REFRESH_THRESHOLD && onRefreshRef.current) {
        setPullVar(PULL_TO_REFRESH_THRESHOLD, RETRACT_MS)
        setIsRefreshing(true)
        void Promise.resolve(onRefreshRef.current()).finally(() => {
          setIsRefreshing(false)
          setPullVar(0, RETRACT_MS)
          pull.current = 0
        })
      }
      else {
        setPullVar(0, RETRACT_MS)
        pull.current = 0
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
      el.style.removeProperty('--dt-pull')
      el.style.removeProperty('--dt-pull-ms')
    }
  }, [scrollRef, onRefresh])

  return { isRefreshing }
}
