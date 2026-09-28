'use client'

import { FilterIcon } from 'lucide-react'

import { AnalyticsFiltersForm } from '@/features/analytics/ui/components/filter-bar/analytics-filters-form'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'

interface Props {
  activeCount: number
}

export function AnalyticsFiltersControl({ activeCount }: Props) {
  const isBelowLg = useIsBelowLg()
  const trigger = (
    <Button variant="outline" size="sm" className="gap-1.5">
      <FilterIcon className="size-4" aria-hidden="true" />
      Filters
      {activeCount > 0 && <span className="tabular-nums text-primary">{activeCount}</span>}
    </Button>
  )
  if (isBelowLg) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <AnalyticsFiltersForm />
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <AnalyticsFiltersForm />
      </PopoverContent>
    </Popover>
  )
}
