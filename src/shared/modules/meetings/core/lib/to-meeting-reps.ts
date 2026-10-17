import type { MeetingParticipantRole } from '@/shared/constants/enums'
import type { MeetingRep } from '@/shared/modules/meetings/core/types'
import { SYSTEM_OWNER_EMAIL } from '@/shared/constants/system-users'
import { PARTICIPANT_ROLE_SORT_ORDER } from '@/shared/entities/meetings/constants/participants'

interface MeetingRepRow {
  role: MeetingParticipantRole
  userName: string
  userEmail: string
  userPhone: string | null
  userHeadshotUrl: string | null
}

/** Owner first, then the co-owner: the people a proposal belongs to. The system user never counts. */
export function toMeetingReps(rows: MeetingRepRow[]): MeetingRep[] {
  return rows
    .filter(row => row.userEmail !== SYSTEM_OWNER_EMAIL)
    .toSorted((a, b) => PARTICIPANT_ROLE_SORT_ORDER[a.role] - PARTICIPANT_ROLE_SORT_ORDER[b.role])
    .map(row => ({ name: row.userName, email: row.userEmail, phone: row.userPhone, headshotUrl: row.userHeadshotUrl }))
}
