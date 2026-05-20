// Meetings business mutations. see ../../DOCS.md for business rules.
// DAL conventions: docs/codebase-conventions/dal-conventions.md
// @migration(meetings-entity-router) — currently called with SYSTEM_CONTEXT from
// the proposals delivery router; will get a sibling queries.ts when meetings
// migrates to the entity server system.

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, eq, inArray } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'

const OVERWRITABLE_OUTCOMES = ['not_set', 'proposal_created'] as const

/**
 * Conditionally flips a meeting's outcome to `proposal_sent`.
 * see ../../DOCS.md#outcome-flips-on-proposal-sent
 */
export async function deriveOutcomeOnProposalSent(
  _ctx: ScopedContext,
  input: { meetingId: string },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db
      .update(meetings)
      .set({ meetingOutcome: 'proposal_sent' })
      .where(and(
        eq(meetings.id, input.meetingId),
        inArray(meetings.meetingOutcome, [...OVERWRITABLE_OUTCOMES]),
      ))
  })
}
