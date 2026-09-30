'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'

import { useCallback, useMemo } from 'react'

import { SCHEDULE_ACTIVITIES_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { activityToCalendarEvent } from '@/features/schedule-management/lib/to-calendar-event'
import { ActivityDotContent } from '@/features/schedule-management/ui/components/activity-dot-content'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { useActivityActionConfigs } from '@/shared/entities/activities/hooks/use-activity-action-configs'
import { formatBusinessTime } from '@/shared/lib/business-time'
import { useTRPC } from '@/trpc/helpers'

interface ScheduleActivitiesCalendarProps {
  showToggle: ReactNode
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
}

export function ScheduleActivitiesCalendar({ showToggle, showSaturday, onToggleSaturday, onNewActivity }: ScheduleActivitiesCalendarProps) {
  const trpc = useTRPC()
  const ability = useAbility()
  const query = useDataViewQuery(trpc.scheduleRouter.activities.list, {}, SCHEDULE_ACTIVITIES_QUERY)
  const { actions, DeleteConfirmDialog } = useActivityActionConfigs<ScheduleCalendarEvent>()

  const permittedActions = useMemo(
    () => actions.filter(({ action }) => !action.permission || ability.can(action.permission[0], action.permission[1])),
    [actions, ability],
  )

  const events = useMemo<ScheduleCalendarEvent[]>(
    () => query.rows.flatMap(row => activityToCalendarEvent(row) ?? []),
    [query.rows],
  )

  const renderCard = useCallback((event: ScheduleCalendarEvent) => (
    <div className="rounded-md border p-2 text-xs">{event.title}</div>
  ), [])

  const renderCompact = useCallback((event: ScheduleCalendarEvent) => (event.kind === 'activity'
    ? <ActivityDotContent event={event} formattedTime={formatBusinessTime(event.startAt, { hour: 'numeric', minute: '2-digit' })} permittedActions={permittedActions} />
    : null), [permittedActions])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <QueryToolbar query={query} entityName="activities">
        <QueryToolbar.Standard leading={showToggle} searchPlaceholder="Search by title or notes…" />
      </QueryToolbar>
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
      <DeleteConfirmDialog />
    </div>
  )
}
