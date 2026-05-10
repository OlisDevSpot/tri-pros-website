'use client'

import type { ReactNode } from 'react'

import type { CalendarViewType } from '@/shared/components/calendar/types'

import { formatDate } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { getRangeText, navigateDate } from '@/shared/components/calendar/lib/calendar-helpers'
import { Button } from '@/shared/components/ui/button'

interface Props {
  currentDate: Date
  activeView: CalendarViewType
  onDateChange: (date: Date) => void
  /** Right-aligned controls (filters, view switcher, actions, etc.) */
  rightSlot?: ReactNode
}

export function CalendarHeader({
  currentDate,
  activeView,
  onDateChange,
  rightSlot,
}: Props) {
  const monthYear = formatDate(currentDate, 'MMM yyyy')
  const rangeText = getRangeText(activeView, currentDate)

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
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevious} aria-label="Previous">
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext} aria-label="Next">
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="h-8" onClick={handleToday}>
          Today
        </Button>

        {/* Desktop/tablet: inline date info */}
        <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
          <span className="truncate text-sm font-semibold">{monthYear}</span>
          <span className="truncate text-xs text-muted-foreground">{rangeText}</span>
        </div>

        {/* Mobile: stacked date info */}
        <div className="flex min-w-0 flex-col gap-0.5 sm:hidden">
          <span className="truncate text-sm font-semibold leading-tight">{monthYear}</span>
          <span className="truncate text-[10px] leading-tight text-muted-foreground">{rangeText}</span>
        </div>
      </div>

      {rightSlot && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {rightSlot}
        </div>
      )}
    </div>
  )
}
