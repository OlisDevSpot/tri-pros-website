'use client'

import type { ReactNode, Ref } from 'react'
import type { PresentationHandle } from '@/features/meeting-flow/types'
import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'
import { PresentationContext } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SnapPresentationProps {
  /** Accessible name for the scroll region, e.g. "Who we are presentation". */
  label: string
  /** The sticky companion: first grid column on lg+, top band below. */
  aside: ReactNode
  children: ReactNode
  className?: string
  /** Imperative `next` / `prev` for the shell's key map (↑ ↓ A Z). */
  ref?: Ref<PresentationHandle>
}

/**
 * Full-height, section-snapping scroller for `presentation`-layout steps.
 * Snap is the browser's (CSS scroll-snap); the JS is in-view tracking plus an
 * absolute `scrollTo` for keyboard beat navigation.
 * Recipes and citations: docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md,
 * docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md §4.3.
 *
 * Sizing contract: the scroller is a size container, so children size with
 * `cqh`/`cqw`. `--pin-h` is the sticky band height below `lg` (0 on lg+); sections
 * subtract it and the scroller pads snap positions by it. `--stage-inset-b` is the
 * strip at the bottom of the stage that the shell's floating capsule covers; the
 * meeting-flow view publishes it and bottom-anchored content floors its offset at it.
 *
 * The scroller is the step root (`data-step-root`): the view focuses it after a
 * step change, so native scrolling and the flow's key map both target it.
 *
 * The scroller sits inside its own size container of the same box because an
 * element cannot query itself: `scroll-pt-(--pin-h)` is a property OF the
 * scroller, so its `cqh` resolves against the nearest ANCESTOR container. Without
 * the wrapper that is the viewport, and below `lg` snap positions get padded by
 * 30% of the viewport instead of the band, resting every section off the band's
 * edge. Descendants still resolve against the scroller itself.
 */
export function SnapPresentation({ label, aside, children, className, ref }: SnapPresentationProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sectionsRef = useRef(new Map<number, HTMLElement>())
  const pendingIndexRef = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const reportInView = useCallback((index: number, inView: boolean) => {
    if (inView) {
      setActiveIndex(index)
    }
  }, [])

  const registerSection = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      sectionsRef.current.set(index, el)
    }
    else {
      sectionsRef.current.delete(index)
    }
  }, [])

  // The pending target only matters while a smooth scroll is in flight.
  useEffect(() => {
    if (pendingIndexRef.current === activeIndex) {
      pendingIndexRef.current = null
    }
  }, [activeIndex])

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current
    const section = sectionsRef.current.get(index)
    if (!scroller || !section) {
      return
    }
    // Land exactly on the snap position: the section's offset minus the scroller's
    // scroll-padding-top (the pinned band below lg). `behavior` stays 'auto' so
    // `motion-safe:scroll-smooth` decides; an absolute scroll snaps in any direction
    // and is not trapped by `snap-always`.
    const padTop = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0
    pendingIndexRef.current = index
    scroller.scrollTo({ top: section.offsetTop - padTop })
  }, [])

  useImperativeHandle(ref, () => ({
    next: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.min(sectionsRef.current.size - 1, from + 1))
    },
    prev: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.max(0, from - 1))
    },
  }), [activeIndex, scrollToIndex])

  const value = useMemo(
    () => ({ scrollerRef, activeIndex, reportInView, registerSection }),
    [activeIndex, reportInView, registerSection],
  )

  return (
    <MotionConfig reducedMotion="user">
      <PresentationContext value={value}>
        <div className="relative isolate min-h-0 flex-1 [container-type:size]">
          <div
            ref={scrollerRef}
            aria-keyshortcuts={KEY_SHORTCUTS.presentation}
            aria-label={label}
            className={cn(
              'absolute inset-0 overflow-y-auto overscroll-contain',
              'snap-y snap-mandatory motion-safe:scroll-smooth [container-type:size]',
              '[--pin-h:30cqh] lg:[--pin-h:0px] scroll-pt-(--pin-h)',
              'bg-(--presentation-ground) text-white',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
              className,
            )}
            data-step-root
            role="region"
            tabIndex={0}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,38%)_1fr]">
              {aside}
              <div>{children}</div>
            </div>
          </div>
        </div>
      </PresentationContext>
    </MotionConfig>
  )
}
