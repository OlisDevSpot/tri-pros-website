'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { FilterControlField } from '@/shared/components/query-toolbar/ui/filter-control-field'
import { PageSizeSegmented } from '@/shared/components/query-toolbar/ui/page-size-segmented'
import { SheetSection } from '@/shared/components/query-toolbar/ui/sheet-section'
import { QueryToolbarSort } from '@/shared/components/query-toolbar/ui/sort'
import { Button } from '@/shared/components/ui/button'
import { formatTotalCount } from '@/shared/lib/pagination-format'

interface FilterSheetBodyProps {
  onClose: () => void
}

export function FilterSheetBody({ onClose }: FilterSheetBodyProps) {
  const { query, filters, sortOptions } = useQueryToolbarContext()
  const { filterSort } = query
  const visibleFilters = filters.filter(filter => !filter.hidden)
  const hasResetableState = filterSort.activeFilterCount > 0 || !!filterSort.searchInput || !!filterSort.sortBy
  const pageWindow = query.window.kind === 'page' ? query.window : undefined
  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 scrollbar-gutter-stable">
        {visibleFilters.length > 0 && (
          <SheetSection title="Filters" sectionId="qt-section-filters">
            <div className="space-y-3">
              {visibleFilters.map(filter => (
                <FilterControlField key={filter.definition.id} definition={filter.definition} />
              ))}
            </div>
          </SheetSection>
        )}
        {sortOptions.length > 0 && (
          <SheetSection title="Sort" sectionId="qt-section-sort">
            <QueryToolbarSort />
          </SheetSection>
        )}
        {pageWindow && pageWindow.pageSizeOptions.length > 1 && (
          <SheetSection title="Rows per page" sectionId="qt-section-page-size">
            <PageSizeSegmented
              options={pageWindow.pageSizeOptions}
              value={pageWindow.pageSize}
              onChange={pageWindow.setPageSize}
            />
          </SheetSection>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={filterSort.clearFilters}
          disabled={!hasResetableState}
          className="touch-manipulation"
        >
          Reset
        </Button>
        <Button type="button" onClick={onClose} className="touch-manipulation">
          {`View results · ${formatTotalCount(query.total)}`}
        </Button>
      </div>
    </>
  )
}
