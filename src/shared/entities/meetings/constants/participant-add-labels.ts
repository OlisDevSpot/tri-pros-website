import type { MeetingParticipantRole } from '@/shared/constants/enums/meeting-participants'

/** The add affordance's words for the role a picked user will get. */
export const PARTICIPANT_ADD_LABELS = {
  owner: 'Add as owner',
  co_owner: 'Add as co-owner',
  helper: 'Add as helper',
} as const satisfies Record<MeetingParticipantRole, string>
