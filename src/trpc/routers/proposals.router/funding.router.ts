// ─── Funding Router ─────────────────────────────────────────────────────────
// Narrow per-scalar column writes on the proposal (e.g. setCashInDeal → cash_in_deal_cents).
// Each funding scalar gets its own narrow mutation instead of a client-side whole-blob
// reconstruction (seam register ruling 2026-07-16).
//
// Plain leaf: imports pre-scoped procedures from ./procedures.

import z from 'zod'

import { setCashInDeal } from '@/shared/entities/proposals/dal/server/mutations'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalShareableProcedure } from './procedures'

export const fundingRouter = createTRPCRouter({
  setCashInDeal: proposalShareableProcedure
    .input(z.object({
      id: z.string().uuid(),
      token: z.string().optional(),
      cashInDeal: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await setCashInDeal(ctx, { proposalId: input.id, cashInDeal: input.cashInDeal }))
    }),
})
