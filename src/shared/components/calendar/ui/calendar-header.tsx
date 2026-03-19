'use client'

import type { CalendarViewType } from '@/shared/components/calendar/types'

import { formatDate } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, FilterIcon } from 'lucide-react'

import { getRangeText, navigateDate } from '@/shared/components/calendar/lib/calendar-helpers'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface Props {
  currentDate: Date
  activeView: CalendarViewType
  showSaturday: boolean
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarViewType) => void
  onToggleSaturday: () => void
}

export function CalendarHeader({
  currentDate,
  activeView,
  showSaturday,
  onDateChange,
  onViewChange,
  onToggleSaturday,
}: Props) {
  const monthYear = formatDate(currentDate, 'MMM yyyy')

  function handlePrevious() {
    onDateChange(navigateDate(currentDate, activeView, 'previous'))
  }

  function handleNext() {
    onDateChange(navigateDate(currentDate, activeView, 'next'))
  }

  function handleToday() {
    onDateChange(new Date())
  }

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      {/* Left side: navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleToday}>
          Today
        </Button>

        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevious}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-sm font-semibold">{monthYear}</span>
        <span className="text-xs text-muted-foreground">{getRangeText(activeView, currentDate)}</span>
      </div>

      {/* Right side: view toggle + Saturday filter */}
      <div className="flex items-center gap-2">
        {/* Saturday filter — only visible in week view */}
        {activeView === 'week' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FilterIcon size={14} />
                Days
                <Badge variant="secondary" className="px-1.5 text-[10px]">
                  {showSaturday ? '7' : '6'}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-3">
              <p className="mb-3 text-sm font-medium">Visible Days</p>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={showSaturday}
                  onCheckedChange={onToggleSaturday}
                />
                <span className="text-sm">Show Saturday</span>
              </label>
            </PopoverContent>
          </Popover>
        )}

        {/* View toggle */}
        <div className="flex rounded-md border">
          <Button
            variant={activeView === 'week' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => onViewChange('week')}
          >
            Week
          </Button>
          <Button
            variant={activeView === 'month' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => onViewChange('month')}
          >
            Month
          </Button>
        </div>
      </div>
    </div>
  )
}
