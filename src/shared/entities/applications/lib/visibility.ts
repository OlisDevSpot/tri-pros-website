import type { SQL } from 'drizzle-orm'

import type { VisibilityScope } from '@/shared/dal/server/types'

import { applications } from '@/shared/db/schema'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

/** Agent-visibility predicate. see ../DOCS.md#visibility-via-meeting-participation */
export function applicationVisibility({ userId }: VisibilityScope): SQL {
  return userParticipatesInMeeting(userId, applications.meetingId)
}
