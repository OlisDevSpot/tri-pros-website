'use client'

import { cn } from '@/shared/lib/utils'

interface Props {
  customerId: string | null
  customerName: string | null
  onViewProfile?: (customerId: string) => void
  /** Type size and colour; the cell supplies truncation and the link affordance. */
  className?: string
}

export function CustomerNameCell({ customerId, customerName, onViewProfile, className }: Props) {
  if (!customerId || !customerName || !onViewProfile) {
    return <span className={cn('block max-w-full truncate', className)}>{customerName ?? '—'}</span>
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onViewProfile(customerId)
      }}
      className={cn(
        'block max-w-full cursor-pointer truncate text-left',
        'underline decoration-dotted decoration-border-strong underline-offset-[3px]',
        'transition-colors hover:text-foreground hover:decoration-foreground',
        'focus-visible:text-foreground focus-visible:decoration-foreground focus-visible:outline-none',
        className,
      )}
    >
      {customerName}
    </button>
  )
}
