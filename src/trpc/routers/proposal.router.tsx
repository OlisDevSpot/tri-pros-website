import { TRPCError } from '@trpc/server'
import z from 'zod'
import { getFinanceOptions } from '@/shared/dal/server/finance-options/api'
import { createProposal, getProposal, getProposals, updateProposal } from '@/shared/dal/server/proposals/api'
import { insertProposalSchema } from '@/shared/db/schema'
import { resendClient } from '@/shared/services/resend/client'
import { ProposalEmail } from '@/shared/services/resend/templates/proposal-email'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'

export const proposalRouter = createTRPCRouter({
  getProposal: baseProcedure
    .input(z.object({
      proposalId: z.string(),
    }))
    .query(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      return proposal
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
      const proposal = await createProposal(input)

      return proposal
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

  sendProposalEmail: agentProcedure
    .input(z.object({
      proposalId: z.string(),
      email: z.email(),
      token: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx.session

      const { data, error } = await resendClient.emails.send({
        from: 'Tri Pros <info@triprosremodeling.com>',
        to: input.email,
        subject: 'Your Proposal From Tri Pros Remodeling',
        react: <ProposalEmail proposalId={input.proposalId} token={input.token} />,
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
