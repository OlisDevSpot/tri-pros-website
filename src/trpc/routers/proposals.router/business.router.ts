// ─── Business Router ────────────────────────────────────────────────────────
// Enriched reads + complex list with proposal-specific joins/filters. These use
// free-form return types — not Row<TTable> — so they live outside the fixed
// CRUD slots. Plain leaf: imports pre-scoped procedures from ./procedures.

import z from 'zod'

import { getFinanceOptions } from '@/shared/entities/finance-options/dal/server/queries'
import { getFullView, listProposals, proposalListInputSchema } from '@/shared/entities/proposals/dal/server/queries'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalProcedure, proposalPublicProcedure, proposalShareableProcedure } from './procedures'

export const businessRouter = createTRPCRouter({
  getFullView: proposalShareableProcedure
    .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await getFullView(ctx, input)) ?? null
    }),

  list: proposalProcedure
    .input(proposalListInputSchema)
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await listProposals(ctx, input))
    }),

  getFinanceOptions: proposalPublicProcedure
    .query(async () => {
      return getFinanceOptions()
    }),
})
