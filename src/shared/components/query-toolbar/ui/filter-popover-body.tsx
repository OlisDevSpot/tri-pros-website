'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { FilterControlField } from '@/shared/components/query-toolbar/ui/filter-control-field'
import { cn } from '@/shared/lib/utils'

export function FilterPopoverBody() {
  const { query, filters } = useQueryToolbarContext()
  const { filterSort } = query
  const visibleFilters = filters.filter(filter => !filter.hidden)
  const hasResetableState = filterSort.activeFilterCount > 0 || !!filterSort.searchInput || !!filterSort.sortBy
  if (visibleFilters.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-foreground">
          Filters
        </span>
        {hasResetableState && (
          <button
            type="button"
            onClick={filterSort.clearFilters}
            className={cn(
              'rounded text-xs text-muted-foreground transition-colors',
              'hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
            )}
          >
            Reset all
          </button>
        )}
      </div>
      <div className="space-y-3.5 px-4 py-4">
        {visibleFilters.map(filter => (
          <FilterControlField key={filter.definition.id} definition={filter.definition} />
        ))}
      </div>
    </div>
  )
}
