'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface StepRegionProps {
  /** id of the visually hidden step heading rendered inside. */
  labelledBy: string
  children: ReactNode
  className?: string
}

/**
 * The page-step scroller and step root. `tabIndex={-1}` lets the view focus it
 * after a step change (with `preventScroll`), after which native ↑/↓/PageDown
 * scroll it and the flow's key map sees focus inside the stage. It restores the
 * gutters the dashboard template gives every other route and clears the floating
 * capsule with `--stage-inset-b`.
 */
export function StepRegion({ labelledBy, children, className }: StepRegionProps) {
  return (
    <div
      aria-labelledby={labelledBy}
      className={cn(
        'absolute inset-0 overflow-y-auto overscroll-contain px-4 pt-6 pb-(--stage-inset-b) md:px-6',
        'outline-none',
        className,
      )}
      data-step-root
      role="region"
      tabIndex={-1}
    >
      {children}
    </div>
  )
}
