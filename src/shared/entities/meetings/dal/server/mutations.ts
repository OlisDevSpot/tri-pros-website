// ─── Meetings Business Mutations ────────────────────────────────────────────
// @migration(meetings-entity-router)
// This is the first meetings entity DAL function. It follows the DalReturn +
// ScopedContext pattern from day one so no re-work is needed when meetings
// gets its full entity router migration. Currently called with SYSTEM_CONTEXT
// from the proposals delivery router (cross-entity side-effect).
// When the meetings entity router migrates, this file becomes the canonical
// meetings mutations module alongside a queries.ts sibling.

import type { DalReturn, ScopedContext } from '@/shared/dal/server/lib/types'

import { and, eq, inArray } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'

const OVERWRITABLE_OUTCOMES = ['not_set', 'proposal_created'] as const

/**
 * Conditionally flips a meeting's outcome to `proposal_sent`.
 *
 * Only overwrites outcomes that represent "nothing decided yet" (`not_set`,
 * `proposal_created`). Manually-set outcomes and terminal derived outcomes
 * (`converted_to_project`) are preserved.
 *
 * This is a business mutation (conditional WHERE) — not expressible as
 * generic CRUD. The condition is intentional: it prevents overwriting
 * meaningful outcomes when a second proposal is sent on the same meeting.
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
