import { TRPCError } from '@trpc/server'
import z from 'zod'
import { getProposal } from '@/shared/dal/server/proposals/api'
import { contractService } from '@/shared/services/contract.service'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'

export const contractsRouter = createTRPCRouter({
  createContractDraft: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.createSigningRequest(input.proposalId, ownerKey)
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
})
