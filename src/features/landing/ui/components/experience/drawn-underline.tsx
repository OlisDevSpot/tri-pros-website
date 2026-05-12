import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface DrawnUnderlineProps {
  children: ReactNode
  className?: string
}

/**
 * Wraps inline text with an animated underline that draws from left to right
 * on group-hover. Parent link must have `group` class for the trigger.
 */
export function DrawnUnderline({ children, className }: DrawnUnderlineProps) {
  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      <span
        aria-hidden
        className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
    </span>
  )
}
