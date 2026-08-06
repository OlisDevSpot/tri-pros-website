'use client'

import type { TimelineFilterId, TimelineFilterValue } from '@/shared/entities/customers/constants/timeline-view'

import { TIMELINE_FILTERS } from '@/shared/entities/customers/constants/timeline-view'
import { cn } from '@/shared/lib/utils'

interface Props {
  // The active selection may be a chip id or the 'all' sentinel, in which case
  // no chip reads as active.
  value: TimelineFilterValue
  onChange: (id: TimelineFilterId) => void
  counts?: Record<TimelineFilterId, number>
}

export function TimelineFilterChips({ value, onChange, counts }: Props) {
  return (
    <div className="flex w-max items-center gap-1.5" role="group">
      {TIMELINE_FILTERS.map((filter) => {
        const isActive = value === filter.id
        const count = counts?.[filter.id]

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium leading-none transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
            key={filter.id}
            onClick={() => onChange(filter.id)}
            type="button"
          >
            <span className="leading-none">{filter.label}</span>
            {!!count && (
              <span className={cn('text-xs font-normal tabular-nums leading-none', isActive ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
