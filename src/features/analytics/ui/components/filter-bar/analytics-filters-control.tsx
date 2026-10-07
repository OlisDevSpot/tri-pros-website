'use client'

import { FilterIcon } from 'lucide-react'

import { AnalyticsFiltersForm } from '@/features/analytics/ui/components/filter-bar/analytics-filters-form'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { cn } from '@/shared/lib/utils'

interface Props {
  activeCount: number
}

export function AnalyticsFiltersControl({ activeCount }: Props) {
  const isBelowLg = useIsBelowLg()
  const trigger = (
    <Button variant="ghost" size="sm" className={cn('h-7 gap-1.5 px-2.5', activeCount > 0 && 'bg-control-selected hover:bg-control-selected')}>
      <FilterIcon className="size-4" aria-hidden="true" />
      <span className="max-sm:sr-only">Filters</span>
      {activeCount > 0 && <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">{activeCount}</span>}
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
