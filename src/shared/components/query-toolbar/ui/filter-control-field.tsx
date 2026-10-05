'use client'

import type { FilterDefinition, FilterValue } from '@/shared/dal/client/lib/types'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { SingleFilterControl } from '@/shared/components/query-toolbar/ui/single-filter-control'
import { cn } from '@/shared/lib/utils'

interface FilterControlFieldProps {
  definition: FilterDefinition
}

export function FilterControlField({ definition }: FilterControlFieldProps) {
  const { query } = useQueryToolbarContext()
  const value = query.filterSort.filters[definition.id] as FilterValue
  const isActive = value !== undefined
  return (
    <div className="space-y-1.5">
      <span
        className={cn(
          'block text-xs font-medium uppercase tracking-[0.08em] transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground/70',
        )}
      >
        {definition.label}
      </span>
      <SingleFilterControl definition={definition} value={value} onChange={v => query.filterSort.setFilter(definition.id, v)} />
    </div>
  )
}
