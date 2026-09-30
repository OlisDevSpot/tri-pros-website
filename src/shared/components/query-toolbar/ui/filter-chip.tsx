'use client'

import type { FilterDefinition, FilterValue } from '@/shared/dal/client/lib/types'

import { XIcon } from 'lucide-react'

import { formatChipValue } from '@/shared/components/query-toolbar/lib/format-chip-value'
import { cn } from '@/shared/lib/utils'

interface ChipProps {
  definition: FilterDefinition
  value: NonNullable<FilterValue>
  onClear: () => void
}

export function FilterChip({ definition, value, onClear }: ChipProps) {
  const formatted = formatChipValue(definition, value)
  const fullText = `${definition.label}: ${formatted}`
  return (
    <div
      title={fullText}
      className={cn(
        'group/chip inline-flex h-9 max-w-55 items-center gap-1.5 pl-2.5 pr-1',
        // Outline (not filled) so chips read as part of the FilterTrigger control group.
        'rounded-md border border-border bg-transparent',
        'transition-colors hover:border-border hover:bg-muted',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
      )}
    >
      <span className="min-w-0 truncate text-xs leading-none">
        <span className="text-muted-foreground">{`${definition.label}: `}</span>
        <span className="font-medium text-foreground">{formatted}</span>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${definition.label}`}
        className={cn(
          'shrink-0 inline-flex size-6 items-center justify-center rounded-sm touch-manipulation',
          'text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
        )}
      >
        <XIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
