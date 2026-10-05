import type { SQL } from 'drizzle-orm'

import type { VisibilityScope } from '@/shared/dal/server/types'

import { proposals } from '@/shared/db/schema'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

/** Agent-visibility predicate. */
export function proposalVisibility({ userId }: VisibilityScope): SQL {
  return userParticipatesInMeeting(userId, proposals.meetingId)
}
