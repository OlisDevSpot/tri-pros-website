'use client'

import type { TimeRangeChip, TimeRangeKey } from '@/features/lead-sources-admin/constants/time-ranges'

import { cn } from '@/shared/lib/utils'

interface TimeRangeChipsProps {
  chips: readonly TimeRangeChip[]
  value: TimeRangeKey
  onChange: (key: TimeRangeKey) => void
}

export function TimeRangeChips({ chips, value, onChange }: TimeRangeChipsProps) {
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className={cn(
        'flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto',
        'snap-x snap-mandatory scroll-px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'sm:flex-wrap sm:overflow-x-visible sm:snap-none',
      )}
    >
      {chips.map((chip) => {
        const isActive = chip.key === value
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex shrink-0 snap-start items-center rounded-full border px-3 text-xs font-medium tabular-nums motion-safe:transition-colors',
              // Touch target: 44px on mobile, compact on ≥sm.
              'h-11 sm:h-7 sm:px-2.5 sm:py-1',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              isActive
                ? 'border-foreground/20 bg-foreground/5 text-foreground'
                : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
