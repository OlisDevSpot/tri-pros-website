import z from 'zod'

import { canSeeUngatedPhone } from '@/shared/entities/customers/lib/phone-gating-sql'
import { getFinanceOptions } from '@/shared/entities/finance-options/dal/server/queries'
import { getFullView, listProposals, proposalListInputSchema } from '@/shared/modules/proposals/core/dal/server/queries'
import { canReadFullProposal } from '@/shared/modules/proposals/core/lib/can-read-full-proposal'
import { gateCustomerPhone } from '@/shared/modules/proposals/core/lib/gate-customer-phone'
import { toHomeownerProposalView } from '@/shared/modules/proposals/core/lib/to-homeowner-proposal-view'

import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalShareableProcedure } from './procedures'

export const businessRouter = createTRPCRouter({
  getFullView: proposalShareableProcedure
    .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const view = dalToTrpc(await getFullView(ctx, input))
      if (!view) {
        return null
      }
      const ability = ctx.actor.ability
      // The holder of a share link sees their own number; a session reader sees it under the phone rule.
      return canReadFullProposal(ability)
        ? gateCustomerPhone(view, canSeeUngatedPhone(ability))
        : toHomeownerProposalView(ability, view)
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
