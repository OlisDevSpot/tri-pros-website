import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { getProposal } from '@/shared/dal/server/proposals/api'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { defineAbilitiesFor } from '@/shared/permissions/abilities'
import { contractService } from '@/shared/services/contract.service'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'

export const contractsRouter = createTRPCRouter({
  getContractStatus: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      const ability = defineAbilitiesFor(
        ctx.session ? { id: ctx.session.user.id, role: ctx.session.user.role } : null,
      )
      const canRead = ability.can('read', 'Proposal')
      const hasValidToken = input.token && proposal.token === input.token

      if (!canRead && !hasValidToken) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Access denied' })
      }

      if (!proposal.signingRequestId) {
        return null
      }

      try {
        const status = await contractService.getSigningStatus(proposal.signingRequestId)
        return {
          ...status,
          contractSentAt: proposal.contractSentAt,
        }
      }
      catch {
        return null
      }
    }),

  createContractDraft: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.createSigningRequest(input.proposalId, ownerKey)
    }),

  submitContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.sendSigningRequest(input.proposalId, ownerKey)
    }),

  sendContractForSigning: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string() }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
      }

      return contractService.sendSigningRequest(input.proposalId, input.token)
    }),

  recallContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.recallSigningRequest(input.proposalId, ownerKey)
    }),

  resendContract: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.resendSigningRequest(input.proposalId, ownerKey)
    }),

  submitCustomerAge: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      token: z.string().optional(),
      age: z.number().int().min(18).max(120),
    }))
    .mutation(async ({ input, ctx }) => {
      const proposal = await getProposal(input.proposalId)
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }

      // Dual-gate auth: CASL for agents/super-admins, token for homeowners
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

      // Read existing profile to merge (avoid clobbering other fields)
      const [existing] = await db
        .select({ customerProfileJSON: customers.customerProfileJSON })
        .from(customers)
        .where(eq(customers.id, proposal.customer.id))

      const updatedProfile = { ...existing?.customerProfileJSON, age: input.age }

      await db
        .update(customers)
        .set({ customerProfileJSON: updatedProfile })
        .where(eq(customers.id, proposal.customer.id))

      return { success: true, age: input.age }
    }),
})
