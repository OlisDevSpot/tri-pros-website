'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { AppRouter } from '@/trpc/routers/app'

import { useCallback, useMemo } from 'react'

import { toCalendarEvent } from '@/features/meetings/lib/to-calendar-event'
import { CalendarBoard } from '@/shared/components/calendar/ui/calendar-board'

import { MeetingCalendarCard } from './meeting-calendar-card'
import { MeetingCalendarDot } from './meeting-calendar-dot'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

interface MeetingCalendarProps {
  data: MeetingRow[]
  onNavigateToMeeting: (meetingId: string) => void
  onEditMeeting: (meetingId: string) => void
  onStartMeeting: (meetingId: string) => void
  onDuplicateMeeting: (meetingId: string) => void
  onDeleteMeeting: (meetingId: string) => void
  onDateRangeChange?: (range: { from: Date, to: Date }) => void
}

export function MeetingCalendar({
  data,
  onNavigateToMeeting,
  onEditMeeting,
  onStartMeeting,
  onDuplicateMeeting,
  onDeleteMeeting,
  onDateRangeChange,
}: MeetingCalendarProps) {
  const events = useMemo(() => data.map(toCalendarEvent), [data])

  const renderCard = useCallback(
    (event: MeetingCalendarEvent) => (
      <MeetingCalendarCard
        event={event}
        onNavigate={onNavigateToMeeting}
        onEdit={onEditMeeting}
        onStart={onStartMeeting}
        onDuplicate={onDuplicateMeeting}
        onDelete={onDeleteMeeting}
      />
    ),
    [onNavigateToMeeting, onEditMeeting, onStartMeeting, onDuplicateMeeting, onDeleteMeeting],
  )

  const renderCompact = useCallback(
    (event: MeetingCalendarEvent) => (
      <MeetingCalendarDot
        event={event}
        onNavigate={onNavigateToMeeting}
        onEdit={onEditMeeting}
        onStart={onStartMeeting}
        onDuplicate={onDuplicateMeeting}
        onDelete={onDeleteMeeting}
      />
    ),
    [onNavigateToMeeting, onEditMeeting, onStartMeeting, onDuplicateMeeting, onDeleteMeeting],
  )

  return (
    <CalendarBoard
      events={events}
      config={{ defaultView: 'week', hiddenDays: [6], weekStartsOn: 0 }}
      renderCard={renderCard}
      renderCompact={renderCompact}
      onDateRangeChange={onDateRangeChange}
    />
  )
}
