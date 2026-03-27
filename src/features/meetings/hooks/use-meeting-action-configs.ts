import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useMemo } from 'react'

import { MEETING_ACTIONS } from '@/shared/components/entity-actions/constants/meeting-actions'

import { useMeetingActions } from './use-meeting-actions'

interface MeetingEntity {
  id: string
}

interface MeetingActionHandlers<T extends MeetingEntity> {
  onView: (entity: T) => void
  onEdit: (entity: T) => void
  onStart?: (entity: T) => void
  onCreateProposal?: (entity: T) => void
  onAssignOwner?: (entity: T) => void
}

export function useMeetingActionConfigs<T extends MeetingEntity>(
  handlers: MeetingActionHandlers<T>,
): EntityActionConfig<T>[] {
  const { deleteMeeting, duplicateMeeting } = useMeetingActions()

  return useMemo((): EntityActionConfig<T>[] => {
    const configs: EntityActionConfig<T>[] = [
      {
        action: MEETING_ACTIONS.view,
        onAction: handlers.onView,
      },
      {
        action: MEETING_ACTIONS.edit,
        onAction: handlers.onEdit,
      },
      {
        action: MEETING_ACTIONS.duplicate,
        onAction: entity => duplicateMeeting.mutate({ id: entity.id }),
        isLoading: duplicateMeeting.isPending,
      },
    ]

    if (handlers.onStart) {
      configs.splice(1, 0, {
        action: MEETING_ACTIONS.start,
        onAction: handlers.onStart,
      })
    }

    if (handlers.onCreateProposal) {
      configs.push({
        action: MEETING_ACTIONS.createProposal,
        onAction: handlers.onCreateProposal,
      })
    }

    if (handlers.onAssignOwner) {
      configs.push({
        action: MEETING_ACTIONS.assignOwner,
        onAction: handlers.onAssignOwner,
      })
    }

    configs.push({
      action: MEETING_ACTIONS.delete,
      onAction: entity => deleteMeeting.mutate({ id: entity.id }),
      isLoading: deleteMeeting.isPending,
    })

    return configs
  }, [handlers.onView, handlers.onEdit, handlers.onStart, handlers.onCreateProposal, handlers.onAssignOwner, duplicateMeeting, deleteMeeting])
}
