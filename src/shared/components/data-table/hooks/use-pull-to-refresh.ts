'use client'

import type { RefObject } from 'react'

import { useEffect, useRef, useState } from 'react'

/** Pixels of (damped) pull past which release triggers a refresh. */
export const PULL_TO_REFRESH_THRESHOLD = 64
const MAX_PULL = 96
const RESISTANCE = 0.5

interface PullToRefreshState {
  pullDistance: number
  isRefreshing: boolean
  isThresholdReached: boolean
}

/**
 * Standard pull-down-to-refresh, TOUCH ONLY. Binds non-passive touch listeners
 * to `scrollRef`. Engages only when the container is scrolled to the very top,
 * the drag is downward and predominantly vertical, and the gesture did not
 * start on a column-resize handle (`[data-resize-handle]`). Past
 * `PULL_TO_REFRESH_THRESHOLD`, release calls `onRefresh()` and holds the
 * spinner until the returned promise settles. No-op when `onRefresh` is
 * undefined (non-paginated DataTable uses).
 *
 * See `docs/superpowers/specs/2026-08-11-records-table-refresh-design.md` §6.1.
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  onRefresh: (() => Promise<unknown> | void) | undefined,
): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Gesture bookkeeping in refs — no re-render during move tracking.
  const startY = useRef(0)
  const startX = useRef(0)
  const engaged = useRef(false)
  const pull = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const refreshingRef = useRef(false)
  refreshingRef.current = isRefreshing

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onRefresh) {
      return
    }

    function setPull(next: number) {
      pull.current = next
      setPullDistance(next)
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
        setPull(0)
        return
      }
      e.preventDefault() // we own the pull — suppress native rubber-band/scroll
      setPull(Math.min(dy * RESISTANCE, MAX_PULL))
    }

    function handleTouchEnd() {
      if (!engaged.current) {
        return
      }
      engaged.current = false
      if (pull.current >= PULL_TO_REFRESH_THRESHOLD && onRefreshRef.current) {
        setIsRefreshing(true)
        setPull(PULL_TO_REFRESH_THRESHOLD)
        void Promise.resolve(onRefreshRef.current()).finally(() => {
          setIsRefreshing(false)
          setPull(0)
        })
      }
      else {
        setPull(0)
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [scrollRef, onRefresh])

  return {
    pullDistance,
    isRefreshing,
    isThresholdReached: pullDistance >= PULL_TO_REFRESH_THRESHOLD,
  }
}
