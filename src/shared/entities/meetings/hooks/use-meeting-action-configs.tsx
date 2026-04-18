'use client'

import type { JSX } from 'react'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useCallback, useMemo, useState } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'
import { MEETING_OUTCOME_OPTIONS } from '@/shared/entities/meetings/constants/outcome-options'
import { useConfirm } from '@/shared/hooks/use-confirm'

import { useMeetingActions } from './use-meeting-actions'

// ── Stable top-level component — never causes unmount/remount ──────────────

interface AssignOwnerDialogProps {
  target: { meetingId: string } | null
  onClose: () => void
}

function InternalAssignOwnerDialog({ target, onClose }: AssignOwnerDialogProps) {
  return (
    <ManageParticipantsModal
      meetingIds={target ? [target.meetingId] : []}
      open={!!target}
      onOpenChange={open => !open && onClose()}
    />
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface MeetingEntity {
  id: string
  meetingOutcome?: string
  customerId?: string | null
  scheduledFor?: string | null
  ownerId?: string | null
}

interface MeetingActionOverrides<T extends MeetingEntity> {
  onView?: (entity: T) => void
  onStart?: (entity: T) => void
  onViewSchedule?: (entity: T) => void
  onAssignProject?: (entity: T) => void
  onCreateProposal?: (entity: T) => void
  /** Override the default assign-owner dialog behavior */
  onAssignOwner?: (entity: T) => void
}

interface MeetingActionConfigsResult<T extends MeetingEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
  AssignOwnerDialog: () => JSX.Element
}

function defaultNavigate(entity: { id: string }) {
  window.location.href = ROOTS.dashboard.meetings.byId(entity.id)
}

function defaultViewSchedule(entity: { id: string, scheduledFor?: string | null }) {
  const params = new URLSearchParams({ highlightMeeting: entity.id })
  if (entity.scheduledFor) {
    params.set('highlightDate', entity.scheduledFor)
  }
  window.location.href = `${ROOTS.dashboard.schedule()}?${params.toString()}`
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

  // Internal assign-owner dialog state (used when no override provided)
  const [assignTarget, setAssignTarget] = useState<{
    meetingId: string
  } | null>(null)

  const defaultAssignOwner = useCallback((entity: T) => {
    setAssignTarget({ meetingId: entity.id })
  }, [])

  const clearAssignTarget = useCallback(() => setAssignTarget(null), [])

  // Stable component identity — props change, component reference does not
  const AssignOwnerDialog = useCallback(
    () => <InternalAssignOwnerDialog target={assignTarget} onClose={clearAssignTarget} />,
    [assignTarget, clearAssignTarget],
  )

  const actions = useMemo((): EntityActionConfig<T>[] => {
    const configs: EntityActionConfig<T>[] = [
      {
        action: MEETING_ACTIONS.view,
        onAction: overrides.onView ?? defaultNavigate,
      },
      {
        action: MEETING_ACTIONS.viewSchedule,
        onAction: overrides.onViewSchedule ?? defaultViewSchedule,
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
      // Always present — CASL permission ['assign', 'Meeting'] controls visibility
      {
        action: MEETING_ACTIONS.assignOwner,
        onAction: overrides.onAssignOwner ?? defaultAssignOwner,
      },
    ]

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
  }, [overrides, duplicateMeeting, updateOutcome, deleteMeeting, confirmDelete, defaultAssignOwner])

  return { actions, DeleteConfirmDialog, AssignOwnerDialog }
}
