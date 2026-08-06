'use client'

import type { TimelineFilterId } from '@/shared/entities/customers/constants/timeline-view'

import { TIMELINE_FILTERS } from '@/shared/entities/customers/constants/timeline-view'
import { cn } from '@/shared/lib/utils'

interface Props {
  value: TimelineFilterId
  onChange: (id: TimelineFilterId) => void
  counts?: Record<TimelineFilterId, number>
}

export function TimelineFilterChips({ value, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group">
      {TIMELINE_FILTERS.map((filter) => {
        const isActive = value === filter.id
        const count = counts?.[filter.id]

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
            key={filter.id}
            onClick={() => onChange(filter.id)}
            type="button"
          >
            {filter.label}
            {!!count && (
              <span className={cn('text-[10px] tabular-nums', isActive ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
