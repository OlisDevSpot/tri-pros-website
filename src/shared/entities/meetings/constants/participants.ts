import type { MeetingParticipantRole } from '@/shared/constants/enums'

export const PARTICIPANT_ROLE_SORT_ORDER: Record<MeetingParticipantRole, number> = {
  owner: 0,
  co_owner: 1,
  helper: 2,
}
