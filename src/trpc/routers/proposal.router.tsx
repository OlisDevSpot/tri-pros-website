import { TRPCError } from '@trpc/server'
import z from 'zod'
import { ROOTS } from '@/shared/config/roots'
import { getFinanceOptions } from '@/shared/dal/server/finance-options/api'
import { createProposal, deleteProposal, getProposal, getProposals, updateProposal } from '@/shared/dal/server/proposals/api'
import { insertProposalSchema } from '@/shared/db/schema'
import { updatePageUrlProperty } from '@/shared/services/notion/dal/update-page-property'
import { resendClient } from '@/shared/services/resend/client'
import ProposalEmail from '@/shared/services/resend/emails/proposal-email'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'

export const proposalRouter = createTRPCRouter({
  getProposal: baseProcedure
    .input(z.object({
      proposalId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const proposal = await getProposal(input.proposalId)

        if (!proposal) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            cause: 'Proposal not found',
          })
        }

        return proposal
      }
      catch (e) {
        if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            cause: e,
          })
        }
      }
    }),

  getProposals: agentProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx.session

      const proposals = await getProposals(user.id)

      return proposals
    }),

  createProposal: baseProcedure
    .input(insertProposalSchema.strict())
    .mutation(async ({ input }) => {
      try {
        const proposal = await createProposal(input)

        if (!proposal) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            cause: 'Proposal not created',
          })
        }
        const proposalUrl = `${ROOTS.proposalFlow({ absolute: true, isProduction: true })}/proposal/${proposal.id}?token=${proposal.token}`

        if (proposal.notionPageId) {
          await updatePageUrlProperty(proposal.notionPageId, `Proposals Link`, proposalUrl)
        }

        const proposalData = {
          proposal,
          proposalUrl,
        }

        return proposalData
      }
      catch (e) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: e,
        })
      }
    }),

  updateProposal: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      token: z.string().optional(),
      data: insertProposalSchema.partial().strict(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.session?.user

      if (user) {
        try {
          const proposal = await updateProposal(user.id, input.proposalId, input.data)
          return proposal
        }
        catch {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            cause: 'Unauthorized',
          })
        }
      }

      if (!input.token) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          cause: 'Unauthorized',
        })
      }

      const proposal = await updateProposal(input.token, input.proposalId, input.data)

      return proposal
    }),

  deleteProposal: agentProcedure
    .input(z.object({
      proposalId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await deleteProposal(input.proposalId)
    }),

  sendProposalEmail: agentProcedure
    .input(z.object({
      proposalId: z.string(),
      customerName: z.string(),
      email: z.email(),
      token: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx.session

      const { data, error } = await resendClient.emails.send({
        from: 'Tri Pros <info@triprosremodeling.com>',
        to: input.email,
        bcc: 'info@triprosremodeling.com',
        subject: 'Your Proposal From Tri Pros Remodeling',
        react: (
          <ProposalEmail
            proposalUrl={`${ROOTS.proposalFlow({ absolute: true, isProduction: true })}/proposal/${input.proposalId}?token=${input.token}`}
            customerName={input.customerName}
          />
        ),
      })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }

      const proposal = await updateProposal(user.id, input.proposalId, { status: 'sent' })

      if (!proposal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          cause: 'Proposal not found',
        })
      }

      return { data, input, proposal }
    }),

  getFinanceOptions: baseProcedure
    .query(async () => {
      try {
        const financeOptions = await getFinanceOptions()

        return financeOptions
      }
      catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }
    }),
})
