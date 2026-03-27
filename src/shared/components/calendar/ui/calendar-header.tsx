'use client'

import type { CalendarViewType } from '@/shared/components/calendar/types'

import { formatDate } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { getRangeText, navigateDate } from '@/shared/components/calendar/lib/calendar-helpers'
import { Button } from '@/shared/components/ui/button'

interface Props {
  currentDate: Date
  activeView: CalendarViewType
  onDateChange: (date: Date) => void
}

export function CalendarHeader({
  currentDate,
  activeView,
  onDateChange,
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
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevious}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop: date info + Today button inline */}
        <span className="hidden text-sm font-semibold sm:inline">{monthYear}</span>
        <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">{getRangeText(activeView, currentDate)}</span>

        {/* Mobile: stacked date info */}
        <div className="flex flex-col gap-0.5 sm:hidden">
          <span className="text-sm font-semibold leading-tight">{monthYear}</span>
          <span className="text-[10px] leading-tight text-muted-foreground">{getRangeText(activeView, currentDate)}</span>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={handleToday}>
        Today
      </Button>
    </div>
  )
}
