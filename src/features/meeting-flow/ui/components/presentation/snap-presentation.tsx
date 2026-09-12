'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { PresentationContext } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SnapPresentationProps {
  /** Accessible name for the scroll region, e.g. "Who we are presentation". */
  label: string
  /** The sticky companion: first grid column on lg+, top band below. */
  aside: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Full-height, section-snapping scroller for `presentation`-layout steps.
 * Snap is the browser's (CSS scroll-snap); the only JS is in-view tracking.
 * Recipe and citations: docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md
 *
 * Sizing contract: the scroller is a size container, so children size with
 * `cqh`/`cqw`. `--pin-h` is the sticky band height below `lg` (0 on lg+); sections
 * subtract it and the scroller pads snap positions by it. `--pres-chrome-b` is the
 * strip of the scroller the meeting-flow footer's Context and Persona triggers
 * float over (they sit `bottom-full` above the footer); bottom-anchored content
 * floors its offset at it so the triggers never cover a line.
 *
 * The scroller sits inside its own size container of the same box because an
 * element cannot query itself: `scroll-pt-(--pin-h)` is a property OF the
 * scroller, so its `cqh` resolves against the nearest ANCESTOR container. Without
 * the wrapper that is the viewport, and below `lg` snap positions get padded by
 * 30% of the viewport instead of the band, resting every section off the band's
 * edge. Descendants still resolve against the scroller itself.
 */
export function SnapPresentation({ label, aside, children, className }: SnapPresentationProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const reportInView = useCallback((index: number, inView: boolean) => {
    if (inView) {
      setActiveIndex(index)
    }
  }, [])

  const value = useMemo(
    () => ({ scrollerRef, activeIndex, reportInView }),
    [activeIndex, reportInView],
  )

  return (
    <MotionConfig reducedMotion="user">
      <PresentationContext value={value}>
        <div className="relative isolate min-h-0 flex-1 [container-type:size]">
          <div
            ref={scrollerRef}
            aria-label={label}
            className={cn(
              'absolute inset-0 overflow-y-auto overscroll-contain',
              'snap-y snap-mandatory motion-safe:scroll-smooth [container-type:size]',
              '[--pin-h:30cqh] lg:[--pin-h:0px] scroll-pt-(--pin-h) [--pres-chrome-b:3.5rem]',
              '[--presentation-ground:oklch(0.2_0.028_257)] [--presentation-accent:oklch(0.8_0.12_259.8)]',
              'bg-(--presentation-ground) text-white',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
              className,
            )}
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
