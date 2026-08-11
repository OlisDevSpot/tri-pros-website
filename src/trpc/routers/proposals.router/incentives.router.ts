// ─── Incentives Router ──────────────────────────────────────────────────────
// proposal_incentives child rows (Wave 2). Replace-all upsert from the funding
// form. Freeze gate (contractEnvelopeId) enforced in the DAL.
// see ../../../shared/entities/proposals/DOCS.md#final-tcp-derived
//
// Plain leaf: imports pre-scoped procedures from ./procedures. The inline CASL
// check is consolidated into a shared `assertCanUpdateProposal` in S5. When
// `proposal_incentives` becomes a full child entity (S4), this leaf moves onto
// the subEntitySpec-derived procedures.

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { replaceProposalIncentives } from '@/shared/entities/proposal-incentives/dal/server/mutations'
import { incentiveSchema } from '@/shared/entities/proposals/schemas'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalProcedure } from './procedures'

export const incentivesRouter = createTRPCRouter({
  replace: proposalProcedure
    .input(z.object({
      proposalId: z.string().uuid(),
      incentives: z.array(incentiveSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'Proposal')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this proposal.',
        })
      }
      return dalToTrpc(await replaceProposalIncentives(ctx, input))
    }),
})
