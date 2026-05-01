import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, lte, max, or, sql } from 'drizzle-orm'
import z from 'zod'
import { ROOTS } from '@/shared/config/roots'
import { proposalStatuses } from '@/shared/constants/enums'
import { pipelines } from '@/shared/constants/enums/pipelines'
import { getFinanceOptions } from '@/shared/dal/server/finance-options/api'
import { createProposal, deleteProposal, getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { buildFilterWhere } from '@/shared/dal/server/query/filters'
import { paginate } from '@/shared/dal/server/query/output'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/query/schemas'
import { buildOrderBy } from '@/shared/dal/server/query/sort'
import { db } from '@/shared/db'
import { insertProposalSchema } from '@/shared/db/schema'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
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

  // Server-paginated proposals list. Drives the Past Proposals table and the
  // dashboard-widget recent-proposals strip. Super-admins see all proposals;
  // agents see ones they own.
  //
  // Filters (URL-driven via the query toolkit):
  //   status:     multi-select on proposals.status
  //   createdAt:  date-range on proposals.createdAt
  //   sentAt:     date-range on proposals.sentAt
  //   pipeline:   'projects' | 'fresh' | 'rehash' | 'dead' (derived from
  //               meetings.projectId IS NOT NULL → 'projects', else
  //               meetings.pipeline)
  //   customerId: scope to one customer (profile modal)
  //   meetingId:  scope to one meeting (meeting overview card list)
  //
  // Search: ilike against proposals.label OR customers.name.
  // Sort whitelist: createdAt, sentAt, status, label, customerName, viewCount.
  // Default order: createdAt DESC.
  list: agentProcedure
    .input(paginatedQueryInput({
      status: z.array(z.enum(proposalStatuses)).optional(),
      createdAt: dateRangeSchema.optional(),
      sentAt: dateRangeSchema.optional(),
      pipeline: z.enum(pipelines).optional(),
      customerId: z.string().uuid().optional(),
      meetingId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session
      const isOmni = ctx.ability.can('manage', 'all')

      const baseScope = isOmni ? undefined : eq(proposals.ownerId, user.id)

      const searchTerm = input.search?.trim()
      const searchWhere = searchTerm
        ? or(
            ilike(proposals.label, `%${searchTerm}%`),
            ilike(customers.name, `%${searchTerm}%`),
          )
        : undefined

      const filterWhere = buildFilterWhere(input.filters, {
        status: v => (v.length > 0 ? inArray(proposals.status, v) : undefined),
        createdAt: v => and(
          v.from ? gte(proposals.createdAt, v.from) : undefined,
          v.to ? lte(proposals.createdAt, v.to) : undefined,
        ),
        sentAt: v => and(
          v.from ? gte(proposals.sentAt, v.from) : undefined,
          v.to ? lte(proposals.sentAt, v.to) : undefined,
        ),
        pipeline: (v) => {
          if (v === 'projects') {
            return sql`${meetings.projectId} IS NOT NULL`
          }
          if (v === 'leads') {
            return sql`FALSE`
          }
          return and(
            sql`${meetings.projectId} IS NULL`,
            eq(meetings.pipeline, v),
          )
        },
        customerId: v => eq(customers.id, v),
        meetingId: v => eq(proposals.meetingId, v),
      })

      const where = and(baseScope, searchWhere, filterWhere)

      const orderBy = buildOrderBy(input.sort, {
        createdAt: proposals.createdAt,
        sentAt: proposals.sentAt,
        status: proposals.status,
        label: proposals.label,
        customerName: customers.name,
      }, desc(proposals.createdAt))

      return paginate({
        query: () => db
          .select({
            ...getTableColumns(proposals),
            viewCount: count(proposalViews.id),
            lastViewedAt: max(proposalViews.viewedAt),
            customerId: customers.id,
            customerName: customers.name,
            meetingPipeline: meetings.pipeline,
            meetingProjectId: meetings.projectId,
          })
          .from(proposals)
          .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
          .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
          .leftJoin(customers, eq(customers.id, meetings.customerId))
          .where(where)
          .groupBy(proposals.id, customers.id, customers.name, meetings.pipeline, meetings.projectId)
          .orderBy(...orderBy)
          .limit(input.pagination.limit)
          .offset(input.pagination.offset),
        // Count proposals matching where — joins to meetings/customers are
        // 1:1 (FK), so count(proposals.id) is distinct without DISTINCT.
        count: async () => {
          const [row] = await db
            .select({ c: count(proposals.id) })
            .from(proposals)
            .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
            .leftJoin(customers, eq(customers.id, meetings.customerId))
            .where(where)
          return row?.c ?? 0
        },
      })
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
