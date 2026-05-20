// Meeting-flow feature router. Procedures that serve the meeting-flow
// feature (persona profile, in-meeting customer profile updates).
// These are feature-specific — not entity CRUD — so they use agentProcedure
// directly, not the entity toolkit.

import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { buildPersonaProfile } from '@/features/meeting-flow/lib/build-persona-profile'
import { getCachedPainPoints } from '@/features/meeting-flow/lib/get-cached-pain-points'
import { buildUserContext } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerProfileSchema, financialProfileSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { getByIdWithJoins } from '@/shared/entities/meetings/dal/server/queries'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { ably } from '@/shared/services/providers/upstash/realtime'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../init'

export const meetingFlowRouter = createTRPCRouter({
  // Update customer profile from within the meeting flow (emits realtime sync event)
  updateCustomerProfile: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      customerId: z.string().uuid(),
      customerProfileJSON: customerProfileSchema.optional(),
      propertyProfileJSON: propertyProfileSchema.optional(),
      financialProfileJSON: financialProfileSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { meetingId, customerId, ...profiles } = input
      const updated = dalToTrpc(await customerCrud.update(SYSTEM_CONTEXT, {
        id: customerId,
        data: profiles,
      }))
      void ably.channels.get(`meeting:${meetingId}`).publish('meeting.updated', {
        fields: Object.keys(profiles),
      })
      return updated
    }),

  // Build the persona profile for a meeting (fears, benefits, decision drivers, etc.)
  getPersonaProfile: agentProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const scopedCtx = buildUserContext(ctx.session.user.id, ctx.session.user.role, meetingServerSpec)
      const row = dalToTrpc(await getByIdWithJoins(scopedCtx, { id: input.meetingId }))
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }
      const customer = row.customer?.id ? row.customer : null
      const painPointsDb = await getCachedPainPoints()
      return buildPersonaProfile({
        customerProfile: customer?.customerProfileJSON ?? null,
        propertyProfile: customer?.propertyProfileJSON ?? null,
        financialProfile: customer?.financialProfileJSON ?? null,
        meetingContext: row.contextJSON ?? null,
        flowState: row.flowStateJSON ?? null,
        painPointsDb,
      })
    }),
})
