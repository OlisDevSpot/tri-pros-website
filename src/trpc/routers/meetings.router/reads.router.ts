import { TRPCError } from '@trpc/server'
import { inArray } from 'drizzle-orm'
import z from 'zod'

import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import { getByIdWithJoins, listMeetings, meetingListInputSchema } from '@/shared/entities/meetings/dal/server/queries'
import { createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { meetingProcedure } from './procedures'

export const readsRouter = createTRPCRouter({
  list: meetingProcedure
    .input(meetingListInputSchema)
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await listMeetings(ctx, input))
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
