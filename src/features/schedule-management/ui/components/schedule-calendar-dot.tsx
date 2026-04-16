'use client'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { format } from 'date-fns'

import { useAbility } from '@/shared/domains/permissions/hooks'

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

  const formattedTime = format(new Date(event.startAt), 'h:mm a')

  const permittedActions = actions.filter(({ action }) => {
    if (!action.permission) {
      return true
    }
    return ability.can(action.permission[0], action.permission[1])
  })

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
