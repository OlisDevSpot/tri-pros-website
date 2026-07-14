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
import { customerProfilePatchSchema } from '@/shared/db/schema'
import { upsertCustomerProfile } from '@/shared/entities/customers/dal/server/mutations'
import { getByIdWithJoins } from '@/shared/entities/meetings/dal/server/queries'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { ably } from '@/shared/services/providers/upstash/realtime'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../init'

export const meetingFlowRouter = createTRPCRouter({
  // Upsert into customer_profiles from within the meeting flow (Addendum B
  // 1:1 child table; emits realtime sync event). Flat column patch — no
  // read-modify-merge, the column IS the field.
  updateCustomerProfile: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      customerId: z.string().uuid(),
      patch: customerProfilePatchSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'CustomerProfile')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update the customer profile.',
        })
      }
      const { meetingId, customerId, patch } = input
      const updated = dalToTrpc(await upsertCustomerProfile(SYSTEM_CONTEXT, {
        customerId,
        patch,
      }))
      // Inline await — ephemeral realtime fan-out is the explicit exception
      // to background-side-effects-via-qstash-jobs (routing through QStash
      // would defeat sub-100ms broadcast). Failure is logged, not surfaced —
      // an unsubscribed channel or transient Ably 5xx shouldn't fail the
      // profile-save mutation.
      await ably.channels
        .get(`meeting:${meetingId}`)
        .publish('meeting.updated', { fields: Object.keys(patch) })
        .catch(err => console.warn('[meeting-flow] ably publish failed:', err))
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
        customer,
        meetingContext: row.contextJSON ?? null,
        flowState: row.flowStateJSON ?? null,
        painPointsDb,
      })
    }),
})
