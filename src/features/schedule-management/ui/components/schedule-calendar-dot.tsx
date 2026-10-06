'use client'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

import { getVisibleActions } from '@/shared/components/entities/entity-actions/lib/visible-actions'
import { useAbility } from '@/shared/domains/permissions/client'
import { formatBusinessTime } from '@/shared/lib/business-time'

import { ActivityDotContent } from './activity-dot-content'
import { MeetingDotContent } from './meeting-dot-content'

interface ScheduleCalendarDotProps {
  event: ScheduleCalendarEvent
  actions: EntityActionConfig<ScheduleCalendarEvent>[]
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
}

export function ScheduleCalendarDot({
  event,
  actions,
  onUpdateScheduledFor,
}: ScheduleCalendarDotProps) {
  const ability = useAbility()

  const formattedTime = formatBusinessTime(event.startAt, { hour: 'numeric', minute: '2-digit' })

  const permittedActions = getVisibleActions(actions, ability, event)

  if (event.kind === 'meeting') {
    return (
      <MeetingDotContent
        event={event}
        formattedTime={formattedTime}
        permittedActions={permittedActions}
        onUpdateScheduledFor={onUpdateScheduledFor}
      />
    )
  }

  return (
    <ActivityDotContent
      event={event}
      formattedTime={formattedTime}
      permittedActions={permittedActions}
    />
  )
}
