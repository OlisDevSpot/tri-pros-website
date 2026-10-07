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
        'flex w-fit max-w-full min-w-0 flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-control-border bg-tab-track p-0.5',
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
              'inline-flex shrink-0 snap-start items-center rounded-md px-3 text-xs font-medium tabular-nums motion-safe:transition-colors',
              // Touch target: 44px with the track's padding on mobile, compact on ≥sm.
              'h-9.5 sm:h-7 sm:px-2.5 sm:py-1',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              isActive
                ? 'bg-tab-active text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground pressed:bg-press',
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
