'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface InlineSheetBodyProps {
  children: ReactNode
  className?: string
}

// The part of an InlineSheet that may outgrow it. It scrolls natively, so a drag that starts here
// scrolls instead of closing the sheet; everywhere else on the sheet a downward drag closes it.
export function InlineSheetBody({ children, className }: InlineSheetBodyProps) {
  return (
    <div className={cn('min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain', className)} data-inline-sheet-scroll>
      {children}
    </div>
  )
}
