'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { FilterControlField } from '@/shared/components/query-toolbar/ui/filter-control-field'
import { PageSizeSegmented } from '@/shared/components/query-toolbar/ui/page-size-segmented'
import { SheetSection } from '@/shared/components/query-toolbar/ui/sheet-section'
import { Button } from '@/shared/components/ui/button'
import { formatTotalCount } from '@/shared/lib/pagination-format'

interface SheetBodyProps {
  onClose: () => void
}

export function FilterSheetBody({ onClose }: SheetBodyProps) {
  const ctx = useQueryToolbarContext()
  const hasResetableState = ctx.activeFilterCount > 0 || !!ctx.searchInput || !!ctx.sortBy
  const showPageSize = !!ctx.pageSizeOptions && ctx.pageSizeOptions.length > 1
  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 scrollbar-gutter-stable">
        {ctx.filterDefinitions.length > 0 && (
          <SheetSection title="Filters" sectionId="qt-section-filters">
            <div className="space-y-3">
              {ctx.filterDefinitions.map(def => (
                <FilterControlField key={def.id} definition={def} />
              ))}
            </div>
          </SheetSection>
        )}
        {showPageSize && (
          <SheetSection title="Rows per page" sectionId="qt-section-page-size">
            <PageSizeSegmented
              options={ctx.pageSizeOptions!}
              value={ctx.pageSize}
              onChange={ctx.setPageSize}
            />
          </SheetSection>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={ctx.clearFilters}
          disabled={!hasResetableState}
          className="touch-manipulation"
        >
          Reset
        </Button>
        <Button type="button" onClick={onClose} className="touch-manipulation">
          {`View results · ${formatTotalCount(ctx.total)}`}
        </Button>
      </div>
    </>
  )
}
