import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'

import { canRescheduleFromOutcome, meetingOutcomes, outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { addParticipant, getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { buildRescheduleNote, formatMeetingDateShort } from '@/shared/entities/meetings/lib/notes'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { createTRPCRouter } from '../../init'
import { meetingProcedure } from './procedures'

export const businessRouter = createTRPCRouter({
  /**
   * Sets a meeting outcome that requires a documented reason, and appends the
   * reason as a customer note in one call. Routes the outcome write through
   * meetingCrud.update so the entity hooks fire (pipeline derivation +
   * GCal/Ably). The note goes through customerNoteCrud.create (the
   * customer-notes entity's generic create — see issue #280).
   *
   * Only accepts reason-requiring outcomes; positive/unset/neutral outcomes
   * use the generic crud.update path instead.
   */
  setOutcomeWithReason: meetingProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      outcome: z.enum(meetingOutcomes),
      reason: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!outcomeRequiresReason(input.outcome)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Outcome "${input.outcome}" does not require a reason; use crud.update.`,
        })
      }

      // Look up the meeting's customer + date for the note (customer may be null).
      const [row] = await db
        .select({ customerId: meetings.customerId, scheduledFor: meetings.scheduledFor })
        .from(meetings)
        .where(eq(meetings.id, input.meetingId))
        .limit(1)
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found.' })
      }

      // 1. Set the outcome through the entity hook chain.
      const updated = dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: input.outcome },
      }))

      // 2. Append the reason as a customer note (skip if the meeting has no customer).
      if (row.customerId) {
        const label = MEETING_OUTCOME_LABELS[input.outcome]
        const meetingDate = formatMeetingDateShort(row.scheduledFor)
        const note = await customerNoteCrud.create(ctx, {
          customerId: row.customerId,
          content: `${meetingDate} meeting results:\nOutcome set to ${label}\n${input.reason}`,
        })
        if (!note.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Outcome saved but note failed.' })
        }
      }

      return updated
    }),

  /**
   * Reschedule: keep the original meeting (set it to `cancelled` — the archived
   * disposition) and book a NEW meeting at the new time, copying the original's
   * owner + participants + customer/project/type + flowStateJSON (same sit, new
   * slot — trade selections etc. continue; this is the ONLY path that carries
   * flow state, duplicate deliberately does not — see
   * meetings/DOCS.md#duplicate-copies-setup-only). Composes DAL blocks in the
   * router (no service). Order = create-new → then cancel-original so a failure
   * never leaves a cancelled meeting with no replacement. see meetings/DOCS.md#reschedule-cancels-and-rebooks
   */
  rescheduleMeeting: meetingProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      newScheduledFor: z.string().datetime(),
      reason: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      if (new Date(input.newScheduledFor).getTime() <= Date.now()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'The new meeting time must be in the future.' })
      }

      // Scope-checked load (getById applies ctx.scope → undefined if not visible).
      const original = dalToTrpc(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found.' })
      }
      if (!canRescheduleFromOutcome(original.meetingOutcome)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `A meeting with outcome "${original.meetingOutcome}" already happened and can't be rescheduled — book a new meeting instead.`,
        })
      }

      // Preserve identity: the new meeting's owner is the original's OWNER
      // participant (visibility is participant-based), so create.after re-adds
      // the correct owner participant; we copy the rest below.
      const participants = await getParticipantsForMeeting(input.meetingId)
      const ownerParticipant = participants.find(p => p.role === 'owner')
      const replacementOwnerId = ownerParticipant?.userId ?? original.ownerId

      // 1. Book the replacement under SYSTEM_CONTEXT so create.before passes the
      //    explicit ownerId through (an authed office reschedule would otherwise
      //    reassign it to the office user). create.after adds the owner
      //    participant + dispatches GCal sync / graduation / Meta CAPI.
      const replacement = dalVerifySuccess(await meetingCrud.create(SYSTEM_CONTEXT, {
        ownerId: replacementOwnerId,
        customerId: original.customerId,
        projectId: original.projectId,
        meetingType: original.meetingType,
        scheduledFor: input.newScheduledFor,
        // Same sit, new slot: the in-meeting working state (trade selections,
        // program, deal structure, closing adjustments) continues in the
        // replacement. null → undefined because the insert schema is
        // `.optional()`, not `.nullable()`. see meetings/DOCS.md#reschedule-cancels-and-rebooks
        flowStateJSON: original.flowStateJSON ?? undefined,
      }))

      // 2. Copy the non-owner participants (owner already added by create.after).
      for (const p of participants) {
        if (p.role !== 'owner') {
          await addParticipant(replacement.id, p.userId, p.role)
        }
      }

      // 3. Cancel the original (→ update.after removes its GCal event, Task 3) +
      //    post one customer note. Order per D7: create is already done above.
      dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: 'cancelled' },
      }))
      if (original.customerId) {
        const note = await customerNoteCrud.create(ctx, {
          customerId: original.customerId,
          content: buildRescheduleNote(original.scheduledFor, input.newScheduledFor, input.reason),
        })
        if (!note.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Meeting rescheduled but note failed.' })
        }
      }

      return replacement
    }),
})
