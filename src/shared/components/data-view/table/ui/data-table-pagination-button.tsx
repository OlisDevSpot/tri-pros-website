'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface DataTablePaginationButtonProps {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
  className?: string
}

/**
 * Single Prev / Next cell of the pagination footer. Fills its grid column
 * (`w-full`) so the user can tap anywhere in the cell — not just the icon —
 * which is critical for thumb reach on mobile.
 *
 * Icon is decorative (`aria-hidden`); the visible label is sr-only on `<lg`
 * to keep the cell narrow on phones, then promoted to visible alongside the
 * chevron at `lg`+.
 */
export function DataTablePaginationButton({
  direction,
  disabled,
  onClick,
  className,
}: DataTablePaginationButtonProps) {
  const isPrev = direction === 'prev'
  const Icon = isPrev ? ChevronLeft : ChevronRight
  const label = isPrev ? 'Previous page' : 'Next page'
  const visibleLabel = isPrev ? 'Previous' : 'Next'

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'h-11 lg:h-9 w-full rounded-none touch-manipulation',
        'gap-1.5',
        isPrev ? 'justify-start lg:justify-center' : 'justify-end lg:justify-center',
        className,
      )}
    >
      {isPrev && <Icon className="size-4" aria-hidden />}
      <span className="sr-only lg:not-sr-only">{visibleLabel}</span>
      {!isPrev && <Icon className="size-4" aria-hidden />}
    </Button>
  )
}
