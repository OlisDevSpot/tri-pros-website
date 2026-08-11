// ─── Customer Profile Router ─────────────────────────────────────────────────
// customer_profiles 1:1 child table (Addendum B). Own CASL subject
// ('CustomerProfile') — a different permission boundary than Customer's
// contact/identity fields. Lazy upsert: row-exists = discovery data collected.

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { customerProfilePatchSchema } from '@/shared/db/schema'
import { upsertCustomerProfile } from '@/shared/entities/customers/dal/server/mutations'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { customerProcedure } from './procedures'

export const profileRouter = createTRPCRouter({
  upsert: customerProcedure
    .input(z.object({ id: z.string().uuid(), data: customerProfilePatchSchema }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'CustomerProfile')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update the customer profile.',
        })
      }
      return dalToTrpc(await upsertCustomerProfile(ctx, { customerId: input.id, patch: input.data }))
    }),
})
