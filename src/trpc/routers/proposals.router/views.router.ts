import z from 'zod'

import { SHARE_LINK_LIMITS } from '@/shared/modules/proposals/core/lib/share-link-rate-limit'
import { proposalService } from '@/shared/modules/proposals/service'
import { getProposalViews } from '@/shared/modules/proposals/views/dal/server/queries'

import { agentProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalShareableProcedure } from './procedures'

const recordViewSchema = z.object({
  proposalId: z.string(),
  token: z.string(),
  source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
  referer: z.string().optional(),
  userAgent: z.string().optional(),
})

export const viewsRouter = createTRPCRouter({
  recordView: proposalShareableProcedure
    .input(recordViewSchema)
    .mutation(async ({ ctx, input }) => {
      // Staff opening the page is not a homeowner's visit.
      if (ctx.session) {
        return
      }
      const { success } = await SHARE_LINK_LIMITS.view(input.token)
      if (!success) {
        return
      }
      dalToTrpc(await proposalService.views.record(ctx, {
        proposalId: input.proposalId,
        source: input.source,
        referer: input.referer,
        userAgent: input.userAgent,
      }))
    }),

  getProposalViews: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await getProposalViews(ctx, { proposalId: input.proposalId }))
    }),
})
