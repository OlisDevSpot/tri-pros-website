'use client'

import type { ReactNode } from 'react'
import { useInView } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import { SectionInViewContext, usePresentation } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SnapSectionProps {
  /** Position in the presentation; reported as the active index when in view. */
  index: number
  id: string
  /** id of the heading element rendered inside this section. */
  labelledBy: string
  children: ReactNode
  className?: string
}

/**
 * One snap target. The <section> box is never transformed: snap areas are computed
 * from the transformed border box, so every reveal lives on an inner element.
 *
 * `scrollMarginTop: 0` is load-bearing: `src/app/(frontend)/globals.css` sets a
 * global `* { scroll-margin-top: 80px }` rule for the marketing site's fixed-header
 * anchors, which would otherwise shift every snap position by 80px. This inline
 * override is deliberate so it can't be lost to Tailwind's class-merge or
 * clobbered by a caller-supplied `className`.
 */
export function SnapSection({ index, id, labelledBy, children, className }: SnapSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollerRef, reportInView, registerSection } = usePresentation()
  const inView = useInView(ref, { root: scrollerRef, amount: 0.5 })

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el
    registerSection(index, el)
  }, [index, registerSection])

  useEffect(() => {
    reportInView(index, inView)
  }, [index, inView, reportInView])

  return (
    <SectionInViewContext value={inView}>
      <section
        ref={setRef}
        aria-labelledby={labelledBy}
        className={cn(
          'relative min-h-[calc(100cqh-var(--pin-h))] snap-start snap-always overflow-hidden',
          className,
        )}
        id={id}
        style={{ scrollMarginTop: 0 }}
      >
        {children}
      </section>
    </SectionInViewContext>
  )
}
