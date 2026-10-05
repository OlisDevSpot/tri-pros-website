'use client'

import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { useState } from 'react'
import { useAbility } from '@/shared/domains/permissions/hooks'

// The rail and the phone New sheet are two entry points to the same verbs; holding the dialog
// state here lets CustomerProfileCommandDialogs mount each dialog once for both.
export function useProfileCommands(): ProfileCommands {
  const ability = useAbility()
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  return {
    canAddMeeting: ability.can('create', 'Meeting'),
    canAddProposal: ability.can('create', 'Proposal'),
    meetingOpen,
    noteOpen,
    openMeeting: () => setMeetingOpen(true),
    openNote: () => setNoteOpen(true),
    setMeetingOpen,
    setNoteOpen,
  }
}
