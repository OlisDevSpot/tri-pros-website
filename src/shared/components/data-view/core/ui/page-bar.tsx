import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface PageBarProps {
  /** The page's title row and its toolbar, stacked in that order. */
  children: ReactNode
  className?: string
}

// A page's title and toolbar share one surface, so the page chrome sits on rung 1 like the content below it and the
// controls inside climb a rung on their own. Bare on the canvas, the title and outline buttons painted nothing.
export function PageBar({ children, className }: PageBarProps) {
  return (
    <div className={cn('surface flex flex-col gap-2 rounded-xl border px-3 py-2', className)}>
      {children}
    </div>
  )
}
