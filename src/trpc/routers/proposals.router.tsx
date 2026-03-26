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
import { meetings } from '@/shared/db/schema/meetings'
import { defineAbilitiesFor } from '@/shared/permissions/abilities'
import { DS_REST_BASE_URL } from '@/shared/services/docusign/constants'
import { buildEnvelopeBody } from '@/shared/services/docusign/lib/build-envelope-body'
import { getAccessToken } from '@/shared/services/docusign/lib/get-access-token'
import { resendClient } from '@/shared/services/resend/client'
import ProposalEmail from '@/shared/services/resend/emails/proposal-email'
import ProposalViewedEmail from '@/shared/services/resend/emails/proposal-viewed-email'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'

export const proposalsRouter = createTRPCRouter({
  getProposal: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      token: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Proposal not found',
        })
      }

      // Access check: valid session with read permission OR valid share token
      const ability = defineAbilitiesFor(
        ctx.session ? { id: ctx.session.user.id, role: ctx.session.user.role } : null,
      )
      const canRead = ability.can('read', 'Proposal')
      const hasValidToken = input.token && proposal.token === input.token

      if (!canRead && !hasValidToken) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'A valid token or authenticated session is required to view this proposal',
        })
      }

      return proposal
    }),

  getProposals: agentProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx.session
      const isOmni = ctx.ability.can('manage', 'all')

      const proposals = await getProposals(user.id, isOmni)

      return proposals
    }),

  createProposal: agentProcedure
    .input(insertProposalSchema.strict())
    .mutation(async ({ input: rawInput }) => {
      try {
        if (!rawInput.meetingId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A meetingId is required to create a proposal',
          })
        }

        // Snapshot meeting trade selections into proposal SOW
        let input = rawInput
        const [meetingRow] = await db
          .select({ flowStateJSON: meetings.flowStateJSON })
          .from(meetings)
          .where(eq(meetings.id, rawInput.meetingId))

        const tradeSelections = meetingRow?.flowStateJSON?.tradeSelections
        if (tradeSelections && tradeSelections.length > 0) {
          const projectJSON = (rawInput.projectJSON ?? {}) as Record<string, unknown>
          const data = (projectJSON.data ?? {}) as Record<string, unknown>

          if (!data.sow) {
            const sowFromSelections = tradeSelections.map(entry => ({
              trade: { id: entry.tradeId, label: entry.tradeName },
              scopes: entry.selectedScopes,
              title: '',
              contentJSON: '',
              html: '',
            }))

            input = {
              ...rawInput,
              projectJSON: {
                ...projectJSON,
                data: {
                  ...data,
                  sow: sowFromSelections,
                },
              },
            } as typeof rawInput
          }
        }

        const proposal = await createProposal(input)

        if (!proposal) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            cause: 'Proposal not created',
          })
        }
        const proposalUrl = `${ROOTS.public.proposals({ absolute: true })}/proposal/${proposal.id}?token=${proposal.token}`

        return { proposal, proposalUrl }
      }
      catch (e) {
        if (e instanceof TRPCError) {
          throw e
        }
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
      // Same dual-gate as getProposal: CASL ability OR valid share token
      const ability = defineAbilitiesFor(
        ctx.session ? { id: ctx.session.user.id, role: ctx.session.user.role } : null,
      )
      const canUpdate = ability.can('update', 'Proposal')

      if (canUpdate) {
        const proposal = await updateProposal(ctx.session!.user.id, input.proposalId, input.data)
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }
        return proposal
      }

      // Token-based access for unauthenticated homeowners
      if (!input.token) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'A valid token or authenticated session is required to update this proposal',
        })
      }

      const proposal = await updateProposal(input.token, input.proposalId, input.data)
      if (!proposal) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token or proposal not found' })
      }

      return proposal
    }),

  deleteProposal: agentProcedure
    .input(z.object({
      proposalId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await deleteProposal(input.proposalId)
    }),

  duplicateProposal: agentProcedure
    .input(z.object({
      proposalId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const source = await getProposal(input.proposalId)

      if (!source) {
        throw new TRPCError({ code: 'NOT_FOUND', cause: 'Proposal not found' })
      }

      const duplicate = await createProposal({
        label: `Copy of ${source.label}`,
        ownerId: ctx.session.user.id,
        status: 'draft',
        formMetaJSON: source.formMetaJSON,
        projectJSON: source.projectJSON,
        fundingJSON: source.fundingJSON,
        financeOptionId: source.financeOptionId ?? undefined,
        meetingId: source.meetingId ?? undefined,
      })

      return duplicate
    }),

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

      const { data, error } = await resendClient.emails.send({
        from: 'Tri Pros <info@triprosremodeling.com>',
        to: input.email,
        bcc: 'info@triprosremodeling.com',
        subject: 'Your Proposal From Tri Pros Remodeling',
        react: (
          <ProposalEmail
            proposalUrl={`${ROOTS.public.proposals({ absolute: true, isProduction: true })}/proposal/${input.proposalId}?token=${input.token}&utm_source=email`}
            customerName={input.customerName}
            repMessage={input.message}
          />
        ),
      })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }

      const proposal = await updateProposal(user.id, input.proposalId, {
        status: 'sent',
        sentAt: new Date().toISOString(),
      })

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

          const fullProposal = await getProposal(input.proposalId)
          if (!fullProposal) {
            return
          }

          const accessToken = await getAccessToken()
          const body = buildEnvelopeBody(fullProposal, 'created')

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

          const customerName = proposal.customer?.name ?? 'Customer'
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
