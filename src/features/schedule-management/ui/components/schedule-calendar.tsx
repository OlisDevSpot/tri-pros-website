'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { DateWindowControls } from '@/shared/dal/client/lib/types'

import { useCallback, useMemo } from 'react'

import { DEFAULT_HIDDEN_DAYS } from '@/features/schedule-management/constants/schedule-calendar-config'
import { calendarDayToLocalDate, localDateToCalendarDay } from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarHeader } from '@/shared/components/calendar/ui/calendar-header'
import { CalendarMonthView } from '@/shared/components/calendar/ui/calendar-month-view'
import { businessToday } from '@/shared/lib/business-time'

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
  const { anchor, view, setAnchor } = dateWindow
  const currentDate = useMemo(() => calendarDayToLocalDate(anchor), [anchor])
  const handleDateChange = useCallback((date: Date) => {
    const calendarDay = localDateToCalendarDay(date)
    // Today is the default window, so it clears `s_d` rather than pinning a date in the URL.
    setAnchor(calendarDay === businessToday() ? undefined : calendarDay)
  }, [setAnchor])

  const hiddenDays = showSaturday
    ? DEFAULT_HIDDEN_DAYS.filter(d => d !== 6)
    : [...new Set([...DEFAULT_HIDDEN_DAYS, 6])]

  return (
    <div className="flex h-full w-full flex-col rounded-xl border">
      <CalendarHeader
        currentDate={currentDate}
        activeView={view}
        onDateChange={handleDateChange}
        rightSlot={controlsRight}
      />

      <div className="w-full flex-1 min-h-0 overflow-hidden">
        {view === 'today' && (
          <ScheduleTodayView events={events} currentDate={currentDate} renderCard={renderCard} />
        )}
        {view === 'week' && (
          <ScheduleWeekView events={events} currentDate={currentDate} hiddenDays={hiddenDays} renderCard={renderCard} />
        )}
        {view === 'month' && (
          <CalendarMonthView events={events} currentDate={currentDate} renderCompact={renderCompact} />
        )}
      </div>
    </div>
  )
}
