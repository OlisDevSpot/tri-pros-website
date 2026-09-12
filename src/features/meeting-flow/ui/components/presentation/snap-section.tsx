'use client'

import type { ReactNode } from 'react'
import { useInView } from 'motion/react'
import { useEffect, useRef } from 'react'
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
 */
export function SnapSection({ index, id, labelledBy, children, className }: SnapSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollerRef, reportInView } = usePresentation()
  const inView = useInView(ref, { root: scrollerRef, amount: 0.5 })

  useEffect(() => {
    reportInView(index, inView)
  }, [index, inView, reportInView])

  return (
    <SectionInViewContext.Provider value={inView}>
      <section
        ref={ref}
        aria-labelledby={labelledBy}
        className={cn(
          'relative min-h-[calc(100cqh-var(--pin-h))] snap-start snap-always overflow-hidden',
          className,
        )}
        id={id}
      >
        {children}
      </section>
    </SectionInViewContext.Provider>
  )
}
