'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { DateWindowControls } from '@/shared/dal/client/lib/types'

import { useCallback, useMemo } from 'react'

import { DEFAULT_HIDDEN_DAYS } from '@/features/schedule-management/constants/schedule-calendar-config'
import { SCHEDULE_FRAME_CLASS } from '@/features/schedule-management/constants/schedule-frame'
import { calendarDayToLocalDate, localDateToCalendarDay } from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarHeader } from '@/shared/components/calendar/ui/calendar-header'
import { CalendarMonthView } from '@/shared/components/calendar/ui/calendar-month-view'
import { businessToday } from '@/shared/lib/business-time'
import { cn } from '@/shared/lib/utils'

import { ScheduleTodayView } from './schedule-today-view'
import { ScheduleWeekView } from './schedule-week-view'

interface ScheduleCalendarProps {
  events: ScheduleCalendarEvent[]
  /** Anchor day and view live in the URL (`s_d`, `s_v`), so the server prefetches the same window. */
  dateWindow: DateWindowControls
  showSaturday?: boolean
  renderCard: (event: ScheduleCalendarEvent) => ReactNode
  renderCompact: (event: ScheduleCalendarEvent) => ReactNode
  /** Right-aligned controls rendered inside the calendar header strip */
  controlsRight?: ReactNode
}

export function ScheduleCalendar({ events, dateWindow, showSaturday = false, renderCard, renderCompact, controlsRight }: ScheduleCalendarProps) {
  const { anchor, view, isPending, setAnchor } = dateWindow
  const currentDate = useMemo(() => calendarDayToLocalDate(anchor), [anchor])
  // Rows from another key would land on the wrong days; the views draw skeletons instead.
  const visibleEvents = useMemo(() => (isPending ? [] : events), [isPending, events])
  const handleDateChange = useCallback((date: Date) => {
    const calendarDay = localDateToCalendarDay(date)
    // Today is the default window, so it clears `s_d` rather than pinning a date in the URL.
    setAnchor(calendarDay === businessToday() ? undefined : calendarDay)
  }, [setAnchor])

  const hiddenDays = showSaturday
    ? DEFAULT_HIDDEN_DAYS.filter(d => d !== 6)
    : [...new Set([...DEFAULT_HIDDEN_DAYS, 6])]

  return (
    <div className="flex h-full w-full flex-col gap-(--gutter)">
      {/* A card of its own, so the grid below can run to the screen edge while the date controls stay put. */}
      <div className="surface rounded-xl border">
        <CalendarHeader
          currentDate={currentDate}
          activeView={view}
          onDateChange={handleDateChange}
          rightSlot={controlsRight}
        />
      </div>

      <div className="w-full min-h-0 flex-1">
        {view === 'today' && (
          <ScheduleTodayView events={visibleEvents} currentDate={currentDate} isPending={isPending} renderCard={renderCard} />
        )}
        {view === 'week' && (
          <ScheduleWeekView events={visibleEvents} currentDate={currentDate} hiddenDays={hiddenDays} isPending={isPending} renderCard={renderCard} />
        )}
        {view === 'month' && (
          <div data-slot="schedule-frame" className={cn(SCHEDULE_FRAME_CLASS, 'h-full')}>
            <CalendarMonthView events={visibleEvents} currentDate={currentDate} isPending={isPending} renderCompact={renderCompact} />
          </div>
        )}
      </div>
    </div>
  )
}
