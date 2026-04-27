'use client'

import { ChevronLeftIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface MobileBackButtonProps {
  label: string
  onClick: () => void
  className?: string
}

/**
 * Back affordance for the mobile drill-down pane. Hidden on lg+ since both
 * panes are visible side-by-side there.
 */
export function MobileBackButton({ label, onClick, className }: MobileBackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-1 self-start pl-0 pr-3 text-sm text-muted-foreground motion-safe:transition-colors hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md',
        'lg:hidden',
        className,
      )}
    >
      <ChevronLeftIcon aria-hidden="true" className="size-4" />
      <span>{label}</span>
    </button>
  )
}
