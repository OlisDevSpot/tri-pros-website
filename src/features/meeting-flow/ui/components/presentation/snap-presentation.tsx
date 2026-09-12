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
 * Sizing contract: this element is a size container, so children size with
 * `cqh`/`cqw`. `--pin-h` is the sticky band height below `lg` (0 on lg+); sections
 * subtract it and the scroller pads snap positions by it.
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
      <PresentationContext.Provider value={value}>
        <div
          ref={scrollerRef}
          aria-label={label}
          className={cn(
            'relative min-h-0 flex-1 overflow-y-auto overscroll-contain',
            'snap-y snap-mandatory motion-safe:scroll-smooth [container-type:size]',
            '[--pin-h:30cqh] lg:[--pin-h:0px] scroll-pt-(--pin-h)',
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
      </PresentationContext.Provider>
    </MotionConfig>
  )
}
