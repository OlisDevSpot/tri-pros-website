import z from 'zod'
import { getProposal } from '@/shared/server/proposal-flow/proposals/api'
import { baseProcedure, createTRPCRouter } from '../init'

export const proposalRouter = createTRPCRouter({
  getProposal: baseProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      return {
        proposal,
      }
    }),
})
