'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'

import { useCallback, useMemo } from 'react'

import { toCalendarEvent } from '@/features/meeting-flow/lib'
import { SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { MeetingCard } from '@/features/schedule-management/ui/components/meeting-card'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleCalendarDot } from '@/features/schedule-management/ui/components/schedule-calendar-dot'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { PageBar } from '@/shared/components/page-bar'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { useTRPC } from '@/trpc/helpers'

interface ScheduleMeetingsCalendarProps {
  showToggle: ReactNode
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
  isHighlighted: (meetingId: string) => boolean
  highlightRef: (meetingId: string) => React.RefCallback<HTMLDivElement>
}

export function ScheduleMeetingsCalendar({ showToggle, showSaturday, onToggleSaturday, onNewActivity, isHighlighted, highlightRef }: ScheduleMeetingsCalendarProps) {
  const trpc = useTRPC()
  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, {}, SCHEDULE_MEETINGS_QUERY)
  const { updateScheduledFor } = useMeetingActions()

  const events = useMemo<ScheduleCalendarEvent[]>(() => query.rows.map(toCalendarEvent), [query.rows])

  // A mutation's result is a new object every render, so a callback built on it would hand every card a new prop
  // each time the calendar re-renders (query state, a host dialog); the stable wrapper lets the memoized cards skip.
  const { onUpdateScheduledFor: handleUpdateScheduledFor } = useStableCallbacks({
    onUpdateScheduledFor: (meetingId: string, date: Date) => {
      updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } })
    },
  })

  const renderCard = useCallback((event: ScheduleCalendarEvent) => {
    if (event.kind !== 'meeting') {
      return null
    }
    const highlighted = isHighlighted(event.meetingId)
    return (
      <MeetingCard
        event={event}
        onUpdateScheduledFor={handleUpdateScheduledFor}
        isHighlighted={highlighted}
        highlightRef={highlighted ? highlightRef(event.meetingId) : undefined}
      />
    )
  }, [handleUpdateScheduledFor, isHighlighted, highlightRef])

  const renderCompact = useCallback((event: ScheduleCalendarEvent) => (
    <ScheduleCalendarDot event={event} onUpdateScheduledFor={handleUpdateScheduledFor} />
  ), [handleUpdateScheduledFor])

  return (
    <MeetingActionsHost>
      <div className="flex h-full min-h-0 flex-col gap-(--gutter)">
        <PageBar>
          <QueryToolbar query={query} entityName="meetings">
            <QueryToolbar.Standard leading={showToggle} searchPlaceholder="Search by customer or type…" />
          </QueryToolbar>
        </PageBar>
        <div className="min-h-0 flex-1">
          <ScheduleCalendar
            events={events}
            dateWindow={query.window}
            showSaturday={showSaturday}
            renderCard={renderCard}
            renderCompact={renderCompact}
            controlsRight={(
              <ScheduleControlsBar
                calendarView={query.window.view}
                onCalendarViewChange={query.window.setView}
                showSaturday={showSaturday}
                onToggleSaturday={onToggleSaturday}
                onNewActivity={onNewActivity}
              />
            )}
          />
        </div>
      </div>
    </MeetingActionsHost>
  )
}
