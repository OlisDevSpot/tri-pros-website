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
      // A signed-in reader is staff; a share link's holder is the homeowner, and the phone is their own.
      const view = dalToTrpc(await getFullView(ctx, input, { gatePhone: ctx.actor.userId !== null }))
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
