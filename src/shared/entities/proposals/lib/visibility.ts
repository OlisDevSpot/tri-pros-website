import type { SQL } from 'drizzle-orm'

import { proposals } from '@/shared/db/schema'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

/** Agent-visibility predicate. see ../DOCS.md#visibility-via-meeting-participation */
export function proposalVisibility(userId: string): SQL {
  return userParticipatesInMeeting(userId, proposals.meetingId)
}
