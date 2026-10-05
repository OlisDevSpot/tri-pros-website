import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface GrowthLayoutProps {
  children: ReactNode
  /** Rows and gaps for the slide's own composition. */
  className?: string
}

/**
 * The content of a growth slide: in flow, at least one screen tall, centred when shorter. On a
 * short screen the slide grows taller instead of clipping its content. Copy ends clear of the
 * floating capsule.
 */
export function GrowthLayout({ children, className }: GrowthLayoutProps) {
  return (
    <div className={cn('grid min-h-[calc(100cqh-var(--band-h,0px))] content-center px-[6cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))]', className)}>
      {children}
    </div>
  )
}
