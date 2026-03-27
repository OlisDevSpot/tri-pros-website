'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { AppRouter } from '@/trpc/routers/app'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { toCalendarEvent } from '@/features/meetings/lib/to-calendar-event'
import { getDateRange } from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarHeader } from '@/shared/components/calendar/ui/calendar-header'
import { CalendarMonthView } from '@/shared/components/calendar/ui/calendar-month-view'

import { MeetingCalendarCard } from './meeting-calendar-card'
import { MeetingCalendarDot } from './meeting-calendar-dot'
import { MeetingTodayView } from './meeting-today-view'
import { MeetingWeekView } from './meeting-week-view'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

const DEFAULT_HIDDEN_DAYS = [6] // Saturday

interface MeetingCalendarProps {
  data: MeetingRow[]
  actions: EntityActionConfig<MeetingCalendarEvent>[]
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onDateRangeChange?: (range: { from: Date, to: Date }) => void
  activeView?: CalendarViewType
  onViewChange?: (view: CalendarViewType) => void
  showSaturday?: boolean
  onToggleSaturday?: () => void
}

export function MeetingCalendar({
  data,
  actions,
  onUpdateScheduledFor,
  onDateRangeChange,
  activeView = 'week',
  showSaturday = false,
}: MeetingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const events = useMemo(() => data.map(toCalendarEvent), [data])

  const hiddenDays = showSaturday
    ? DEFAULT_HIDDEN_DAYS.filter(d => d !== 6)
    : [...new Set([...DEFAULT_HIDDEN_DAYS, 6])]

  // Fire onDateRangeChange when currentDate or activeView changes
  const range = useMemo(
    () => getDateRange(currentDate, activeView),
    [currentDate, activeView],
  )

  useEffect(() => {
    onDateRangeChange?.(range)
  }, [range, onDateRangeChange])

  const renderCard = useCallback(
    (event: MeetingCalendarEvent) => (
      <MeetingCalendarCard
        event={event}
        actions={actions}
        onUpdateScheduledFor={onUpdateScheduledFor}
      />
    ),
    [actions, onUpdateScheduledFor],
  )

  const renderCompact = useCallback(
    (event: MeetingCalendarEvent) => (
      <MeetingCalendarDot
        event={event}
        actions={actions}
        onUpdateScheduledFor={onUpdateScheduledFor}
      />
    ),
    [actions, onUpdateScheduledFor],
  )

  return (
    <div className="flex h-full w-full flex-col rounded-xl border">
      <CalendarHeader
        currentDate={currentDate}
        activeView={activeView}
        onDateChange={setCurrentDate}
      />

      <div className="w-full flex-1 min-h-0 overflow-hidden">
        {activeView === 'today' && (
          <MeetingTodayView
            events={events}
            currentDate={currentDate}
            renderCard={renderCard}
          />
        )}

        {activeView === 'week' && (
          <MeetingWeekView
            events={events}
            currentDate={currentDate}
            hiddenDays={hiddenDays}
            renderCard={renderCard}
          />
        )}

        {activeView === 'month' && (
          <CalendarMonthView
            events={events}
            currentDate={currentDate}
            renderCompact={renderCompact}
          />
        )}
      </div>
    </div>
  )
}
