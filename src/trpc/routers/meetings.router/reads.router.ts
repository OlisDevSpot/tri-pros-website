import { TRPCError } from '@trpc/server'
import { inArray } from 'drizzle-orm'
import z from 'zod'

import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import { getByIdWithJoins, listMeetings, meetingListInputSchema } from '@/shared/entities/meetings/dal/server/queries'
import { createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { meetingProcedure } from './procedures'

export const readsRouter = createTRPCRouter({
  // `liveOnly` stays a top-level input and becomes a fixed filter here, so no toolbar ever shows it.
  list: meetingProcedure
    .input(meetingListInputSchema.extend({ liveOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const { liveOnly, ...query } = input
      const filters = liveOnly ? { ...query.filters, outcome: LIVE_MEETING_OUTCOMES } : query.filters
      return dalToTrpc(await listMeetings(ctx, { ...query, filters }))
    }),

  getByIdWithJoins: meetingProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = dalToTrpc(await getByIdWithJoins(ctx, input))
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }
      return row
    }),

  getInternalUsers: meetingProcedure
    .query(async ({ ctx }) => {
      if (ctx.ability.cannot('assign', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to assign meeting owners' })
      }
      return db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        })
        .from(user)
        .where(inArray(user.role, ['agent', 'super-admin']))
        .orderBy(user.name)
    }),
})
