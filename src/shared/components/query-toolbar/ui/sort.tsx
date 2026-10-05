'use client'

import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon } from 'lucide-react'

import { DEFAULT_ORDER_VALUE } from '@/shared/components/query-toolbar/constants/sort'
import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface SortProps {
  className?: string
}

export function QueryToolbarSort({ className }: SortProps) {
  const { query, sortOptions } = useQueryToolbarContext()
  const { sortBy, sortDir, setSort } = query.filterSort
  if (sortOptions.length === 0) {
    return null
  }
  const isDescending = sortDir === 'desc'
  const DirectionIcon = isDescending ? ArrowDownWideNarrowIcon : ArrowUpNarrowWideIcon
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Select
        value={sortBy ?? DEFAULT_ORDER_VALUE}
        onValueChange={next => setSort(next === DEFAULT_ORDER_VALUE ? undefined : next, sortDir)}
      >
        <SelectTrigger className="h-11 w-full lg:h-9 lg:w-40" aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_ORDER_VALUE}>Default order</SelectItem>
          {sortOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        disabled={!sortBy}
        onClick={() => sortBy && setSort(sortBy, isDescending ? 'asc' : 'desc')}
        aria-label={isDescending ? 'Sorted descending; switch to ascending' : 'Sorted ascending; switch to descending'}
        className="h-11 w-11 shrink-0 px-0 lg:h-9 lg:w-9 touch-manipulation"
      >
        <DirectionIcon className="size-4 opacity-80" aria-hidden />
      </Button>
    </div>
  )
}
