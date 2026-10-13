import z from 'zod'

import { customerProfilePatchSchema } from '@/shared/db/schema'
import { upsertCustomerProfile } from '@/shared/entities/customers/dal/server/mutations'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export const profileRouter = createTRPCRouter({
  // The engine answers forbidden when the actor may not write the profile, and not found when the customer is out of reach.
  upsert: agentProcedure
    .input(z.object({ id: z.string().uuid(), data: customerProfilePatchSchema }))
    .mutation(async ({ ctx, input }) => dalToTrpc(await upsertCustomerProfile(ctx, { customerId: input.id, patch: input.data }))),
})
