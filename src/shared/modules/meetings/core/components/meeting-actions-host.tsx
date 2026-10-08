'use client'

import type { ReactNode } from 'react'

import { createContext, use, useCallback, useState } from 'react'

import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'
import { openModal } from '@/shared/lib/open-modal'

type MeetingActionConfigs = ReturnType<typeof useMeetingActionConfigs>
type MeetingActionOverrides = NonNullable<Parameters<typeof useMeetingActionConfigs>[0]>

interface MeetingActionsHostValue {
  actions: MeetingActionConfigs['actions']
  /** The ⋯ menu's Set Outcome and a card's editable outcome badge share this one reason-dialog flow. */
  changeOutcome: MeetingActionConfigs['changeOutcome']
  /** Opens the host's one participants modal for a meeting. */
  manageParticipants: (meetingId: string) => void
}

const MeetingActionsHostContext = createContext<MeetingActionsHostValue | null>(null)

interface MeetingActionsHostProps {
  /** View-level handlers. Each takes the entity, so one `actions` array serves every card below the host. */
  overrides?: Omit<MeetingActionOverrides, 'onAssignOwner'>
  children: ReactNode
}

// A meeting without a customer has no profile to open.
function openMeetingProfile(entity: { id: string, customerId?: string | null }) {
  if (!entity.customerId) {
    return
  }
  openModal({
    accessor: 'CustomerProfile',
    Component: CustomerProfileModal,
    props: { customerId: entity.customerId, defaultTab: 'meetings' as const, highlightMeetingId: entity.id },
  })
}

export function MeetingActionsHost({ overrides, children }: MeetingActionsHostProps) {
  const [participantsMeetingId, setParticipantsMeetingId] = useState<string | null>(null)
  const manageParticipants = useCallback((meetingId: string) => setParticipantsMeetingId(meetingId), [])

  const { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome } = useMeetingActionConfigs({
    onView: openMeetingProfile,
    ...overrides,
    onAssignOwner: entity => manageParticipants(entity.id),
  })

  // Stable while `actions` is: the host re-rendering (its modal opening, a confirm dialog) must not re-render
  // every card below it.
  const value = useStableCallbacks<MeetingActionsHostValue>({ actions, changeOutcome, manageParticipants })

  return (
    <MeetingActionsHostContext value={value}>
      <DeleteConfirmDialog />
      <OutcomeReasonDialog />
      <RescheduleDialog />
      <ManageParticipantsModal
        meetingIds={participantsMeetingId ? [participantsMeetingId] : []}
        open={participantsMeetingId !== null}
        onOpenChange={open => !open && setParticipantsMeetingId(null)}
      />
      {children}
    </MeetingActionsHostContext>
  )
}

export function useMeetingActionsHost(consumer: string): MeetingActionsHostValue {
  const value = use(MeetingActionsHostContext)
  if (!value) {
    throw new Error(`${consumer} needs a <MeetingActionsHost> above it`)
  }
  return value
}
