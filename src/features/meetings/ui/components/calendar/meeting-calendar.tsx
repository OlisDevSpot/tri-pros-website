'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
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
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onDateRangeChange?: (range: { from: Date, to: Date }) => void
  activeView?: CalendarViewType
  onViewChange?: (view: CalendarViewType) => void
  showSaturday?: boolean
  onToggleSaturday?: () => void
}

export function MeetingCalendar({
  data,
  onNavigateToMeeting,
  onEditMeeting,
  onStartMeeting,
  onDuplicateMeeting,
  onDeleteMeeting,
  onUpdateScheduledFor,
  onDateRangeChange,
  activeView,
  onViewChange,
  showSaturday,
  onToggleSaturday,
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
        onUpdateScheduledFor={onUpdateScheduledFor}
      />
    ),
    [onNavigateToMeeting, onEditMeeting, onStartMeeting, onDuplicateMeeting, onDeleteMeeting, onUpdateScheduledFor],
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
        onUpdateScheduledFor={onUpdateScheduledFor}
      />
    ),
    [onNavigateToMeeting, onEditMeeting, onStartMeeting, onDuplicateMeeting, onDeleteMeeting, onUpdateScheduledFor],
  )

  return (
    <CalendarBoard
      events={events}
      config={{ defaultView: 'week', hiddenDays: [6], weekStartsOn: 0 }}
      renderCard={renderCard}
      renderCompact={renderCompact}
      onDateRangeChange={onDateRangeChange}
      activeView={activeView}
      onViewChange={onViewChange}
      showSaturday={showSaturday}
      onToggleSaturday={onToggleSaturday}
    />
  )
}
