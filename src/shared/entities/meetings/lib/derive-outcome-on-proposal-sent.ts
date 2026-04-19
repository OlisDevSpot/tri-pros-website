import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'

const OVERWRITABLE_OUTCOMES = ['not_set', 'proposal_created'] as const

/**
 * Flip the meeting's outcome to `proposal_sent` when a proposal is delivered.
 *
 * Only overwrites outcomes that represent "nothing decided yet" — i.e. `not_set`
 * or `proposal_created`. Manually-set outcomes (`lost_to_competitor`, `follow_up_needed`,
 * etc.) and terminal derived outcomes (`converted_to_project`) are preserved.
 */
export async function deriveOutcomeOnProposalSent(meetingId: string): Promise<void> {
  await db
    .update(meetings)
    .set({ meetingOutcome: 'proposal_sent' })
    .where(and(
      eq(meetings.id, meetingId),
      inArray(meetings.meetingOutcome, OVERWRITABLE_OUTCOMES),
    ))
}
