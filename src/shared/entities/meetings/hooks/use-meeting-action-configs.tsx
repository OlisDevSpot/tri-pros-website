'use client'

import type { JSX } from 'react'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useRouter } from 'next/navigation'
import { ROOTS } from '@/shared/config/roots'
import { CANNOT_RESCHEDULE_REASON, canRescheduleFromOutcome } from '@/shared/constants/enums/meetings'
import { SetterPicker } from '@/shared/entities/meetings/components/setter-picker'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'
import { MEETING_CONFIRMATION_OPTIONS } from '@/shared/entities/meetings/constants/confirmation-options'
import { MEETING_OUTCOME_OPTIONS } from '@/shared/entities/meetings/constants/outcome-options'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'

import { useMeetingActions } from './use-meeting-actions'
import { useOutcomeChange } from './use-outcome-change'
import { useRescheduleChange } from './use-reschedule-change'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MeetingEntity {
  id: string
  meetingOutcome?: string
  customerId?: string | null
  scheduledFor?: string | null
  confirmedAt?: string | null
  ownerId?: string | null
  /** Absent when the caller's rows don't carry the setter; the action then stays out. */
  setBy?: string | null
}

interface MeetingActionOverrides<T extends MeetingEntity> {
  onView?: (entity: T) => void
  onStart?: (entity: T) => void
  onViewSchedule?: (entity: T) => void
  onAssignProject?: (entity: T) => void
  onCreateProposal?: (entity: T) => void
  /** Required: whoever calls this hook owns the participants modal, so the opener is theirs to supply. */
  onAssignOwner: (entity: T) => void
}

interface MeetingActionConfigsResult<T extends MeetingEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
  OutcomeReasonDialog: () => JSX.Element
  RescheduleDialog: () => JSX.Element
  changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>
}

export function useMeetingActionConfigs<T extends MeetingEntity>(
  overrides: MeetingActionOverrides<T>,
): MeetingActionConfigsResult<T> {
  const router = useRouter()
  const { deleteMeeting, duplicateMeeting, updateConfirmation, updateSetter } = useMeetingActions()
  const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange()
  const { reschedule, RescheduleDialog } = useRescheduleChange()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete meeting',
    message: 'This will permanently delete this meeting and its data. This cannot be undone.',
  })

  const defaultNavigate = (entity: T) => router.push(ROOTS.dashboard.meetings.byId(entity.id))
  const defaultViewSchedule = (entity: T) => router.push(ROOTS.dashboard.scheduleWithMeetingHighlight(entity.id, entity.scheduledFor))
  const defaultCreateProposal = (entity: T) => router.push(ROOTS.dashboard.proposals.newForMeeting(entity.id))

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
        void changeOutcome(entity.id, value as MeetingOutcome)
      },
    },
    {
      action: MEETING_ACTIONS.confirmation,
      type: 'select' as const,
      options: MEETING_CONFIRMATION_OPTIONS,
      getCurrentValue: (entity: T) => entity.confirmedAt ? 'confirmed' : 'unconfirmed',
      onSelect: (entity: T, value: string) => {
        updateConfirmation.mutate({
          id: entity.id,
          data: { confirmedAt: value === 'confirmed' ? new Date().toISOString() : null },
        })
      },
      isLoading: updateConfirmation.isPending,
    },
    {
      action: MEETING_ACTIONS.reschedule,
      onAction: (entity: T) => void reschedule(entity.id),
      getDisabledReason: (entity: T) =>
        canRescheduleFromOutcome((entity.meetingOutcome ?? 'not_set') as MeetingOutcome)
          ? null
          : CANNOT_RESCHEDULE_REASON,
    },
    {
      action: MEETING_ACTIONS.createProposal,
      onAction: overrides.onCreateProposal ?? defaultCreateProposal,
    },
    // Always present — CASL permission ['assign', 'Meeting'] controls visibility.
    {
      action: MEETING_ACTIONS.assignOwner,
      onAction: overrides.onAssignOwner,
    },
  ]

  if (overrides.onAssignProject) {
    configs.push({
      action: MEETING_ACTIONS.assignProject,
      onAction: overrides.onAssignProject,
    })
  }

  configs.push({
    action: MEETING_ACTIONS.setSetter,
    type: 'custom',
    isLoading: updateSetter.isPending,
    // A caller whose rows don't carry the setter can't show the current one, so the action stays out.
    hidden: entity => entity.setBy === undefined,
    renderContent: (entity: T, closeMenu) => (
      <SetterPicker
        value={entity.setBy ?? undefined}
        onPick={(setBy) => {
          closeMenu()
          if (setBy !== entity.setBy) {
            updateSetter.mutate({ id: entity.id, data: { setBy } })
          }
        }}
      />
    ),
  })

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

  // The configs' callbacks close over this render's mutations; only the loading flags should re-render rows.
  const actions = useStableCallbacks(configs)

  return { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome }
}
