// ─── Views Router ───────────────────────────────────────────────────────────
// proposal_views child rows. `recordView` is the public homeowner-open path
// (token IS the authorization — no session); `getProposalViews` is the
// agent-facing stats read. Moved out of delivery.router (S3a) into the child's
// own leaf.
//
// Plain leaf: imports pre-scoped procedures from ./procedures. `recordView` is
// an adapter — validate, one service call, map — the read + token gate + insert
// + notification dispatch live in `proposalService.views.record`.

import z from 'zod'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { proposalService } from '@/shared/modules/proposals/service'
import { getProposalViews } from '@/shared/modules/proposals/views/dal/server/queries'

import { createTRPCRouter, systemProcedure } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalProcedure } from './procedures'

const recordViewSchema = z.object({
  proposalId: z.string(),
  token: z.string(),
  source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
  referer: z.string().optional(),
  userAgent: z.string().optional(),
})

export const viewsRouter = createTRPCRouter({
  recordView: systemProcedure
    .input(recordViewSchema)
    .mutation(async ({ input }) => {
      // SYSTEM_CONTEXT: systemProcedure has no session — the share token proves
      // the caller, and the service performs that check. (#285: bearer actor.)
      dalToTrpc(await proposalService.views.record(SYSTEM_CONTEXT, input))
    }),

  getProposalViews: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await getProposalViews(ctx, { proposalId: input.proposalId }))
    }),
})
