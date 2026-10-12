import z from 'zod'

import { incentiveSchema } from '@/shared/modules/proposals/core/schemas'
import { proposalService } from '@/shared/modules/proposals/service'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export const incentivesRouter = createTRPCRouter({
  replace: agentProcedure
    .input(z.object({
      proposalId: z.string().uuid(),
      incentives: z.array(incentiveSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await proposalService.incentives.replace(ctx, input))
    }),
})
