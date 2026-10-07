// Meeting-flow feature router. Procedures that serve the meeting-flow
// feature (persona profile, in-meeting customer profile updates).
// These are feature-specific — not entity CRUD — so they use agentProcedure
// directly, not the entity toolkit.

import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { buildPersonaProfile } from '@/features/meeting-flow/lib/build-persona-profile'
import { buildUserContext } from '@/shared/dal/server/lib/helpers'
import { customerProfilePatchSchema } from '@/shared/db/schema'
import { upsertCustomerProfile } from '@/shared/entities/customers/dal/server/mutations'
import { getByIdWithJoins } from '@/shared/entities/meetings/dal/server/queries'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { constructionService } from '@/shared/modules/construction/service'
import { realtimeClient } from '@/shared/services/providers/upstash/realtime'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../init'

export const meetingFlowRouter = createTRPCRouter({
  // Upsert into customer_profiles from within the meeting flow; emits a realtime sync event.
  // Flat column patch — no read-modify-merge, the column IS the field.
  updateCustomerProfile: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      customerId: z.string().uuid(),
      patch: customerProfilePatchSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { meetingId, customerId, patch } = input
      const updated = dalToTrpc(await upsertCustomerProfile(ctx, {
        customerId,
        patch,
      }))
      // Inline await — ephemeral realtime fan-out is the explicit exception
      // to background-side-effects-via-qstash-jobs (routing through QStash
      // would defeat sub-100ms broadcast). Failure is logged, not surfaced —
      // an unsubscribed channel or transient Ably 5xx shouldn't fail the
      // profile-save mutation.
      await realtimeClient.publish(`meeting:${meetingId}`, 'meeting.updated', { fields: Object.keys(patch) })
        .catch(err => console.warn('[meeting-flow] ably publish failed:', err))
      return updated
    }),

  // Build the persona profile for a meeting (fears, benefits, decision drivers, etc.)
  getPersonaProfile: agentProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const scopedCtx = buildUserContext({ userId: ctx.session.user.id, ability: ctx.actor.ability }, meetingServerSpec)
      const row = dalToTrpc(await getByIdWithJoins(scopedCtx, { id: input.meetingId }))
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }
      const customer = row.customer?.id ? row.customer : null
      const painPointsDb = await constructionService.getPainPoints()
      return buildPersonaProfile({
        customer,
        meetingContext: row.contextJSON ?? null,
        flowState: row.flowStateJSON ?? null,
        painPointsDb,
      })
    }),
})
