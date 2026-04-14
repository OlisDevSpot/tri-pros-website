import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'
import { ROOTS } from '@/shared/config/roots'
import { getFinanceOptions } from '@/shared/dal/server/finance-options/api'
import { createProposal, deleteProposal, getProposal, getProposals, updateProposal } from '@/shared/dal/server/proposals/api'
import { db } from '@/shared/db'
import { insertProposalSchema } from '@/shared/db/schema'
import { meetings } from '@/shared/db/schema/meetings'
import { defineAbilitiesFor } from '@/shared/permissions/abilities'
import { agentProcedure, baseProcedure, createTRPCRouter } from '../../init'

export const crudRouter = createTRPCRouter({
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
        const isOmni = ability.can('manage', 'all')
        const proposal = await updateProposal(isOmni ? null : ctx.session!.user.id, input.proposalId, input.data)
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
