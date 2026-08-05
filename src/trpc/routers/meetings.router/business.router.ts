import type { PgTable } from 'drizzle-orm/pg-core'
import type { EntityToolkit } from '../../lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'

import { meetingOutcomes, outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'
import { addCustomerNote } from '@/shared/entities/customers/dal/server/mutations'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'

import { createTRPCRouter } from '../../init'

export function createMeetingBusinessRouter(entity: EntityToolkit<PgTable>) {
  return createTRPCRouter({
    /**
     * Sets a meeting outcome that requires a documented reason, and appends the
     * reason as a customer note in one call. Routes the outcome write through
     * meetingCrud.update so the entity hooks fire (pipeline derivation +
     * GCal/Ably). The note goes through addCustomerNote (single note write path).
     *
     * Only accepts reason-requiring outcomes; positive/unset/neutral outcomes
     * use the generic crud.update path instead.
     */
    setOutcomeWithReason: entity.authedProcedure
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
          // Meeting date in the business timezone, e.g. "07/08".
          const meetingDate = new Date(row.scheduledFor).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            timeZone: 'America/Los_Angeles',
          })
          const note = await addCustomerNote({
            customerId: row.customerId,
            content: `${meetingDate} meeting results:\nOutcome set to ${label}\n${input.reason}`,
            authorId: ctx.session.user.id,
          })
          if (!note.success) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Outcome saved but note failed.' })
          }
        }

        return updated
      }),
  })
}
