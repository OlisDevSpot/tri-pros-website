'use client'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'

import { getVisibleActions } from '@/shared/components/entities/entity-actions/lib/visible-actions'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { formatBusinessTime } from '@/shared/lib/business-time'
import { useMeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'

import { ActivityDotContent } from './activity-dot-content'
import { MeetingDotContent } from './meeting-dot-content'

interface ScheduleCalendarDotProps {
  event: ScheduleCalendarEvent
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
}

export function ScheduleCalendarDot({ event, onUpdateScheduledFor }: ScheduleCalendarDotProps) {
  const { actions } = useMeetingActionsHost('ScheduleCalendarDot')
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
