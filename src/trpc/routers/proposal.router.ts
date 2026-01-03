import z from 'zod'
import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { insertProposalSchema } from '@/shared/db/schema'
import { baseProcedure, createTRPCRouter } from '../init'

export const proposalRouter = createTRPCRouter({
  getProposal: baseProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      return proposal
    }),

  updateProposal: baseProcedure
    .input(z.object({ proposalId: z.string(), data: insertProposalSchema.partial().strict() }))
    .mutation(async ({ input }) => {
      const proposal = await updateProposal(input.proposalId, input.data)

      return proposal
    }),
})
