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
    <div role="tablist" aria-label="Time range" className="flex flex-wrap gap-1.5">
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
              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums motion-safe:transition-colors',
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
