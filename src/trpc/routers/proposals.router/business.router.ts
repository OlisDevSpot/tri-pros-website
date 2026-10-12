import z from 'zod'

import { getFinanceOptions } from '@/shared/entities/finance-options/dal/server/queries'
import { getFullView, listProposals, proposalListInputSchema } from '@/shared/modules/proposals/core/dal/server/queries'
import { toHomeownerProposalView } from '@/shared/modules/proposals/core/lib/to-homeowner-proposal-view'

import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalShareableProcedure } from './procedures'

export const businessRouter = createTRPCRouter({
  getFullView: proposalShareableProcedure
    .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const view = dalToTrpc(await getFullView(ctx, input))
      return view ? toHomeownerProposalView(ctx.actor.ability, view) : null
    }),

  list: agentProcedure
    .input(proposalListInputSchema)
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await listProposals(ctx, input))
    }),

  getFinanceOptions: baseProcedure
    .query(async () => {
      return getFinanceOptions()
    }),
})
