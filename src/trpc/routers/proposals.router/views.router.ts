import z from 'zod'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { proposalService } from '@/shared/modules/proposals/service'
import { getProposalViews } from '@/shared/modules/proposals/views/dal/server/queries'

import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

const recordViewSchema = z.object({
  proposalId: z.string(),
  token: z.string(),
  source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
  referer: z.string().optional(),
  userAgent: z.string().optional(),
})

export const viewsRouter = createTRPCRouter({
  recordView: baseProcedure
    .input(recordViewSchema)
    .mutation(async ({ input }) => {
      // No session here: the share token proves the caller, and the service checks it.
      dalToTrpc(await proposalService.views.record(SYSTEM_CONTEXT, input))
    }),

  getProposalViews: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await getProposalViews(ctx, { proposalId: input.proposalId }))
    }),
})
