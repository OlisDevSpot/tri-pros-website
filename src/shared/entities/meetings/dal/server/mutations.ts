// Meetings business mutations.

import type { HomeownerConfirmation } from '@/shared/constants/enums/meetings'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'

import { and, eq, isNull } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { generateToken } from '@/shared/lib/generate-token'
import { realtimeClient } from '@/shared/services/providers/upstash/realtime'

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

const ADDITIONAL_WORK_OVERWRITABLE = ['not_set', 'proposal_created', 'proposal_sent'] as const

/**
 * Flips a meeting's outcome to `additional_work` when an additional-work
 * (upsell) proposal on it is approved/signed. Conditional on the current
 * outcome being in ADDITIONAL_WORK_OVERWRITABLE so it never clobbers a
 * terminal outcome. Routes through meetingCrud.update so entity hooks fire.
 */
export async function deriveOutcomeOnAdditionalWorkApproved(
  ctx: ScopedContext,
  input: { meetingId: string },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ outcome: meetings.meetingOutcome })
      .from(meetings)
      .where(eq(meetings.id, input.meetingId))
      .limit(1)

    if (!row || !(ADDITIONAL_WORK_OVERWRITABLE as readonly string[]).includes(row.outcome)) {
      return
    }

    dalVerifySuccess(await meetingCrud.update(ctx, {
      id: input.meetingId,
      data: { meetingOutcome: 'additional_work' },
    }))
  })
}

/**
 * The token belongs to the visit: after a reschedule the link a homeowner already holds opens the replacement.
 * One transaction and raw updates, so no meeting hook fires and the unique index never sees two rows with one token.
 */
export async function handOffShareToken(input: { fromMeetingId: string, toMeetingId: string }): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.transaction(async (tx) => {
      const [from] = await tx
        .select({ shareToken: meetings.shareToken })
        .from(meetings)
        .where(eq(meetings.id, input.fromMeetingId))
        .for('update')
      if (!from) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await tx.update(meetings).set({ shareToken: generateToken() }).where(eq(meetings.id, input.fromMeetingId))
      await tx.update(meetings).set({ shareToken: from.shareToken }).where(eq(meetings.id, input.toMeetingId))
    })
  })
}

/**
 * Records the homeowner's confirmation once. Null means it was already confirmed, so of two replies
 * racing each other only one gets the row back.
 */
export async function claimHomeownerConfirmation(input: { meetingId: string, via: HomeownerConfirmation }): Promise<Meeting | null> {
  const [row] = await db
    .update(meetings)
    .set({ homeownerConfirmedAt: new Date().toISOString(), homeownerConfirmedVia: input.via })
    .where(and(eq(meetings.id, input.meetingId), isNull(meetings.homeownerConfirmedAt)))
    .returning()
  if (row) {
    await realtimeClient.publish(`meeting:${row.id}`, 'meeting.updated', {
      fields: ['homeownerConfirmedAt', 'homeownerConfirmedVia'],
    })
  }
  return row ?? null
}
