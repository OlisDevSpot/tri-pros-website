import { TRPCError } from '@trpc/server'
import z from 'zod'
import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { getProposalViews, recordProposalView } from '@/shared/dal/server/proposals/proposal-views'
import { emailService } from '@/shared/services/email.service'
import { sendViewNotificationJob } from '@/shared/services/upstash/jobs/send-view-notification'
import { syncContractDraftJob } from '@/shared/services/upstash/jobs/sync-contract-draft'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'

export const deliveryRouter = createTRPCRouter({
  sendProposalEmail: agentProcedure
    .input(z.object({
      proposalId: z.string(),
      customerName: z.string(),
      email: z.email(),
      token: z.string(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx.session
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : user.id

      const { data } = await emailService.sendProposalEmail({
        proposalId: input.proposalId,
        token: input.token,
        customerName: input.customerName,
        email: input.email,
        message: input.message,
      })

      const proposal = await updateProposal(ownerKey, input.proposalId, {
        status: 'sent',
        sentAt: new Date().toISOString(),
      })

      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', cause: 'Proposal not found' })
      }

      // Dispatch async job to sync Zoho Sign draft — client polls until signingRequestId appears
      await syncContractDraftJob.dispatch({ proposalId: input.proposalId, ownerKey })

      return { data, input, proposal }
    }),

  recordView: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      token: z.string(),
      source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
      referer: z.string().optional(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', cause: 'Invalid token' })
      }

      const view = await recordProposalView({
        proposalId: input.proposalId,
        source: input.source,
        referer: input.referer,
        userAgent: input.userAgent,
      })

      void sendViewNotificationJob.dispatch({
        proposalOwnerId: proposal.ownerId,
        proposalLabel: proposal.label,
        proposalId: input.proposalId,
        customerName: proposal.customer?.name ?? 'Customer',
        viewedAt: view.viewedAt,
        source: input.source,
      }).catch(() => {})
    }),

  getProposalViews: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ input }) => {
      return getProposalViews(input.proposalId)
    }),
})
