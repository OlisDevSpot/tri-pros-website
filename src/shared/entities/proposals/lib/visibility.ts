import type { SQL } from 'drizzle-orm'

import { userParticipatesInMeeting } from '@/shared/dal/server/meetings/participants'
import { proposals } from '@/shared/db/schema'

/**
 * Canonical agent-visibility predicate for the proposals entity.
 * Rule: non-omni agent can see a proposal ONLY when they participate
 * in the proposal's meeting (any role). Meeting participation is the bridge.
 * Super-admins bypass scoping entirely (callers pass `scope: null`).
 *
 * Falls back to owner-based scoping when meetingId is null (orphan proposals
 * -- shouldn't normally exist, but defensive).
 */
export function proposalVisibility(userId: string): SQL {
  return userParticipatesInMeeting(userId, proposals.meetingId)
}
