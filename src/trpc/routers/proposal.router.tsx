import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { ROOTS } from '@/shared/config/roots'
import env from '@/shared/config/server-env'
import { getFinanceOptions } from '@/shared/dal/server/finance-options/api'
import { createProposal, deleteProposal, getProposal, getProposals, updateProposal } from '@/shared/dal/server/proposals/api'
import { getProposalViews, recordProposalView } from '@/shared/dal/server/proposals/proposal-views'
import { db } from '@/shared/db'
import { insertProposalSchema } from '@/shared/db/schema'
import { user } from '@/shared/db/schema/auth'
import { DS_REST_BASE_URL } from '@/shared/services/docusign/constants'
import { buildEnvelopeBody } from '@/shared/services/docusign/lib/build-envelope-body'
import { getAccessToken } from '@/shared/services/docusign/lib/get-access-token'
import { updatePageUrlProperty } from '@/shared/services/notion/dal/update-page-property'
import { resendClient } from '@/shared/services/resend/client'
import ProposalEmail from '@/shared/services/resend/emails/proposal-email'
import ProposalViewedEmail from '@/shared/services/resend/emails/proposal-viewed-email'
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
        const proposalUrl = `${ROOTS.proposalFlow({ absolute: true })}/proposal/${proposal.id}?token=${proposal.token}`

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
            proposalUrl={`${ROOTS.proposalFlow({ absolute: true, isProduction: true })}/proposal/${input.proposalId}?token=${input.token}&utm_source=email`}
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

      // Fire-and-forget: create DocuSign draft envelope (does not block email send)
      void (async () => {
        try {
          if (proposal.docusignEnvelopeId) {
            return
          }

          const accessToken = await getAccessToken()

          if (typeof accessToken === 'object' && accessToken.error) {
            return
          }

          const body = buildEnvelopeBody(proposal, 'created')

          const res = await fetch(`${DS_REST_BASE_URL}/restapi/v2.1/accounts/${env.DS_ACCOUNT_ID}/envelopes`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          })

          const envelopeData = await res.json() as { envelopeId?: string }

          if (envelopeData.envelopeId) {
            await updateProposal(user.id, input.proposalId, {
              docusignEnvelopeId: envelopeData.envelopeId,
            })
          }
        }
        catch {
          // Swallow — DocuSign draft failure must not affect the email send
        }
      })()

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

  recordView: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      token: z.string(),
      source: z.enum(['email', 'direct', 'unknown']).default('unknown'),
      referer: z.string().optional(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          cause: 'Invalid token',
        })
      }

      const view = await recordProposalView({
        proposalId: input.proposalId,
        source: input.source,
        referer: input.referer,
        userAgent: input.userAgent,
      })

      // Fire-and-forget: send notification email to proposal owner
      void (async () => {
        try {
          const [owner] = await db.select().from(user).where(eq(user.id, proposal.ownerId))
          if (!owner?.email) {
            return
          }

          const customerName = proposal.homeownerJSON?.data?.name ?? 'Customer'
          const sourceLabel = input.source === 'email' ? 'Opened from email link' : 'Opened directly'

          await resendClient.emails.send({
            from: 'Tri Pros System <info@triprosremodeling.com>',
            to: owner.email,
            subject: `🔔 ${customerName} just opened their proposal`,
            react: (
              <ProposalViewedEmail
                customerName={customerName}
                proposalLabel={proposal.label}
                viewedAt={view.viewedAt}
                sourceLabel={sourceLabel}
                proposalId={input.proposalId}
              />
            ),
          })
        }
        catch {
          // Swallow — notification failure must not affect the customer
        }
      })()
    }),

  getProposalViews: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .query(async ({ input }) => {
      return getProposalViews(input.proposalId)
    }),
})
