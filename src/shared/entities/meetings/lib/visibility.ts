import type { SQL } from 'drizzle-orm'

import { meetings } from '@/shared/db/schema'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

/** Agent-visibility predicate. see ../DOCS.md#visibility-via-participation */
export function meetingVisibility(userId: string): SQL {
  return userParticipatesInMeeting(userId, meetings.id)
}
