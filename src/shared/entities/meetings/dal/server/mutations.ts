// Meetings business mutations. see ../../DOCS.md for business rules.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { eq } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'

const OVERWRITABLE_OUTCOMES = ['not_set', 'proposal_created'] as const

/**
 * Conditionally flips a meeting's outcome to `proposal_sent`.
 *
 * Routes through `meetingCrud.update` so the entity hook fires (pipeline
 * derivation in update.before, ably broadcast in update.after). The flip
 * is conditional on the current outcome being in OVERWRITABLE_OUTCOMES —
 * that pre-check stays a raw SELECT here rather than relying on hooks,
 * since the entity API doesn't have a "compare-and-set" primitive.
 *
 * see ../../DOCS.md#outcome-flips-on-proposal-sent
 */
export async function deriveOutcomeOnProposalSent(
  ctx: ScopedContext,
  input: { meetingId: string },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ outcome: meetings.meetingOutcome })
      .from(meetings)
      .where(eq(meetings.id, input.meetingId))
      .limit(1)

    if (!row || !(OVERWRITABLE_OUTCOMES as readonly string[]).includes(row.outcome)) {
      // Outcome is past the overwritable window — no-op.
      return
    }

    dalVerifySuccess(await meetingCrud.update(ctx, {
      id: input.meetingId,
      data: { meetingOutcome: 'proposal_sent' },
    }))
  })
}
