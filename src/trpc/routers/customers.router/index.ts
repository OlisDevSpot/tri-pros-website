import { TRPCError } from '@trpc/server'
import z from 'zod'

import { buildUserContext, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createEntityRouter } from '../../lib/create-entity-router'
import { createCustomerBusinessRouter } from './business.router'

export const customersRouter = createEntityRouter(customerServerSpec, (entity) => {
  return createTRPCRouter({
    business: createCustomerBusinessRouter(entity),

    /**
     * Updates the customer's age in their profile JSON. Accessible by
     * agents (via session) and homeowners (via proposal token). The token
     * path resolves the customer through the proposal's meeting chain.
     *
     * Uses publicProcedure + manual auth gate because the token belongs
     * to the proposal entity, not the customer entity.
     */
    submitCustomerAge: entity.publicProcedure
      .input(z.object({
        proposalId: z.string().uuid(),
        token: z.string().optional(),
        age: z.number().int().min(18).max(120),
      }))
      .mutation(async ({ input, ctx }) => {
        // Resolve the customer through the proposal
        const proposal = dalVerifySuccess(await getFullView(
          ctx.session
            ? buildUserContext(ctx.session.user.id, ctx.session.user.role, proposalServerSpec)
            : SYSTEM_CONTEXT,
          { id: input.proposalId },
        ))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }

        // Auth gate: session with CASL permission OR valid token
        const ability = defineAbilitiesFor(
          ctx.session ? { id: ctx.session.user.id, role: ctx.session.user.role } : null,
        )
        const canUpdate = ability.can('update', 'Customer')
        const hasValidToken = input.token && proposal.token === input.token

        if (!canUpdate && !hasValidToken) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Access denied' })
        }

        if (!proposal.customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
        }

        // Update customer profile age via CRUD singleton
        const existing = dalVerifySuccess(await customerCrud.getById(SYSTEM_CONTEXT, { id: proposal.customer.id }))
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
        }
        const currentProfile = (existing as Record<string, unknown>).customerProfileJSON as Record<string, unknown> | null
        const updatedProfile = { ...currentProfile, age: input.age }
        dalVerifySuccess(await customerCrud.update(SYSTEM_CONTEXT, {
          id: proposal.customer.id,
          data: { customerProfileJSON: updatedProfile } as Record<string, unknown>,
        }))

        return { success: true, age: input.age }
      }),
  })
})
