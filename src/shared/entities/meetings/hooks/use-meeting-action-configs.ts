'use client'

import type { JSX } from 'react'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useMemo } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'
import { MEETING_OUTCOME_OPTIONS } from '@/shared/entities/meetings/constants/outcome-options'
import { useConfirm } from '@/shared/hooks/use-confirm'

import { useMeetingActions } from './use-meeting-actions'

interface MeetingEntity {
  id: string
  meetingOutcome?: string
  customerId?: string | null
}

interface MeetingActionOverrides<T extends MeetingEntity> {
  onView?: (entity: T) => void
  onStart?: (entity: T) => void
  onAssignProject?: (entity: T) => void
  onCreateProposal?: (entity: T) => void
  onAssignOwner?: (entity: T) => void
}

interface MeetingActionConfigsResult<T extends MeetingEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
}

function defaultNavigate(entity: { id: string }) {
  window.location.href = ROOTS.dashboard.meetings.byId(entity.id)
}

function defaultCreateProposal(entity: { id: string }) {
  window.location.href = `${ROOTS.dashboard.proposals.new()}?meetingId=${entity.id}`
}

export function useMeetingActionConfigs<T extends MeetingEntity>(
  overrides: MeetingActionOverrides<T> = {},
): MeetingActionConfigsResult<T> {
  const { deleteMeeting, duplicateMeeting, updateOutcome } = useMeetingActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete meeting',
    message: 'This will permanently delete this meeting and its data. This cannot be undone.',
  })

  const actions = useMemo((): EntityActionConfig<T>[] => {
    const configs: EntityActionConfig<T>[] = [
      {
        action: MEETING_ACTIONS.view,
        onAction: overrides.onView ?? defaultNavigate,
      },
      {
        action: MEETING_ACTIONS.start,
        onAction: overrides.onStart ?? defaultNavigate,
      },
      {
        action: MEETING_ACTIONS.duplicate,
        onAction: entity => duplicateMeeting.mutate({ id: entity.id }),
        isLoading: duplicateMeeting.isPending,
      },
      {
        action: MEETING_ACTIONS.setOutcome,
        type: 'select' as const,
        options: MEETING_OUTCOME_OPTIONS,
        getCurrentValue: (entity: T) => entity.meetingOutcome ?? 'not_set',
        onSelect: (entity: T, value: string) => {
          updateOutcome.mutate({ id: entity.id, meetingOutcome: value as MeetingOutcome })
        },
        isLoading: updateOutcome.isPending,
      },
      {
        action: MEETING_ACTIONS.createProposal,
        onAction: overrides.onCreateProposal ?? defaultCreateProposal,
      },
    ]

    // Extension actions — only appear when handler provided
    if (overrides.onAssignOwner) {
      configs.push({
        action: MEETING_ACTIONS.assignOwner,
        onAction: overrides.onAssignOwner,
      })
    }

    if (overrides.onAssignProject) {
      configs.push({
        action: MEETING_ACTIONS.assignProject,
        onAction: overrides.onAssignProject,
      })
    }

    configs.push({
      action: MEETING_ACTIONS.delete,
      onAction: async (entity: T) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteMeeting.mutate({ id: entity.id })
        }
      },
      isLoading: deleteMeeting.isPending,
    })

    return configs
  }, [overrides, duplicateMeeting, updateOutcome, deleteMeeting, confirmDelete])

  return { actions, DeleteConfirmDialog }
}
