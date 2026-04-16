'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { AppRouter } from '@/trpc/routers/app'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { toCalendarEvent } from '@/features/meeting-flow/lib'
import { DEFAULT_HIDDEN_DAYS } from '@/features/schedule-management/constants/schedule-calendar-config'
import { getDateRange } from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarHeader } from '@/shared/components/calendar/ui/calendar-header'
import { CalendarMonthView } from '@/shared/components/calendar/ui/calendar-month-view'

import { MeetingCard } from './meeting-card'
import { ScheduleCalendarDot } from './schedule-calendar-dot'
import { ScheduleTodayView } from './schedule-today-view'
import { ScheduleWeekView } from './schedule-week-view'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

interface ScheduleCalendarProps {
  data: MeetingRow[]
  actions: EntityActionConfig<ScheduleCalendarEvent>[]
  additionalEvents?: ScheduleCalendarEvent[]
  onAssignOwner?: (event: ScheduleCalendarEvent) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onDateRangeChange?: (range: { from: Date, to: Date }) => void
  activeView?: CalendarViewType
  onViewChange?: (view: CalendarViewType) => void
  showSaturday?: boolean
  onToggleSaturday?: () => void
  /** When set, navigates the calendar to this date on mount */
  initialDate?: Date
  /** Check if a meeting should be highlighted */
  isHighlighted?: (meetingId: string) => boolean
  /** Ref callback factory for highlighted meetings (for scroll-into-view) */
  highlightRef?: (meetingId: string) => React.RefCallback<HTMLDivElement>
}

export function ScheduleCalendar({
  data,
  actions,
  additionalEvents = [],
  onAssignOwner,
  onUpdateScheduledFor,
  onDateRangeChange,
  activeView = 'week',
  showSaturday = false,
  initialDate,
  isHighlighted,
  highlightRef,
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => initialDate ?? new Date())
  const events = useMemo(() => {
    const meetingEvents: ScheduleCalendarEvent[] = data.map(toCalendarEvent)
    return [...meetingEvents, ...additionalEvents]
  }, [data, additionalEvents])

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
    (event: ScheduleCalendarEvent) => {
      if (event.kind !== 'meeting') {
        // Activity cards will be handled by the consumer in future tasks
        return (
          <div className="rounded-md border p-2 text-xs">
            {event.title}
          </div>
        )
      }

      return (
        <MeetingCard
          event={event}
          onAssignOwner={onAssignOwner}
          onUpdateScheduledFor={onUpdateScheduledFor}
          isHighlighted={isHighlighted?.(event.meetingId)}
          highlightRef={highlightRef?.(event.meetingId)}
        />
      )
    },
    [onAssignOwner, onUpdateScheduledFor, isHighlighted, highlightRef],
  )

  const renderCompact = useCallback(
    (event: ScheduleCalendarEvent) => (
      <ScheduleCalendarDot
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
          <ScheduleTodayView
            events={events}
            currentDate={currentDate}
            renderCard={renderCard}
          />
        )}

        {activeView === 'week' && (
          <ScheduleWeekView
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
