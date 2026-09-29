'use client'

import { SlidersHorizontal } from 'lucide-react'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { useToolbarInternal } from '@/shared/components/query-toolbar/lib/internal-context'
import { FilterPopoverBody } from '@/shared/components/query-toolbar/ui/filter-popover-body'
import { FilterSheetBody } from '@/shared/components/query-toolbar/ui/filter-sheet-body'
import { SheetDragHandle } from '@/shared/components/query-toolbar/ui/sheet-drag-handle'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { cn } from '@/shared/lib/utils'

// Active state shifts the border so icon-only mobile users can still tell filters are on.
export function QueryToolbarFilterTrigger() {
  const { query, filters, sortOptions } = useQueryToolbarContext()
  const { activeFilterCount } = query.filterSort
  const { filterOpen, setFilterOpen } = useToolbarInternal()
  const isBelowLg = useIsBelowLg()

  const hasControls = filters.some(filter => !filter.hidden)
  // Below lg the sheet also carries Sort, so it's worth opening even with no filter controls.
  if (!hasControls && !(isBelowLg && sortOptions.length > 0)) {
    return null
  }

  const visibleLabel = activeFilterCount > 0
    ? `Filters · ${activeFilterCount}`
    : 'Filters'
  const ariaLabel = activeFilterCount > 0
    ? `Filters, ${activeFilterCount} active`
    : 'Filters'
  const triggerClassName = cn(
    'h-11 w-11 lg:h-9 lg:w-auto px-0 lg:px-3 font-normal gap-1.5 touch-manipulation',
    activeFilterCount > 0 && 'border-foreground/60 text-foreground',
  )

  const triggerInner = (
    <>
      <span className="sr-only lg:not-sr-only">{visibleLabel}</span>
      <SlidersHorizontal className="size-4 opacity-80" aria-hidden />
    </>
  )

  if (isBelowLg) {
    return (
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" className={triggerClassName} aria-label={ariaLabel}>
            {triggerInner}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="flex max-h-[85svh] flex-col gap-0 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Filter and sort</SheetTitle>
          </SheetHeader>
          <SheetDragHandle />
          <FilterSheetBody onClose={() => setFilterOpen(false)} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={filterOpen} onOpenChange={setFilterOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={triggerClassName} aria-label={ariaLabel}>
          {triggerInner}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <FilterPopoverBody />
      </PopoverContent>
    </Popover>
  )
}
