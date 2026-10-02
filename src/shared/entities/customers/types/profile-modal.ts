export type CustomerProfileTab = 'overview' | 'meetings' | 'projects'

export type NewSheetChoice = 'proposal' | 'meeting' | 'note'

export type NewSheetStep = 'menu' | 'proposal'

export interface ProfileCommands {
  canAddMeeting: boolean
  canAddProposal: boolean
  meetingOpen: boolean
  noteOpen: boolean
  openMeeting: () => void
  openNote: () => void
  setMeetingOpen: (open: boolean) => void
  setNoteOpen: (open: boolean) => void
}
