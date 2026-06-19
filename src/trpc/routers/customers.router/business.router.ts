import type { PgTable } from 'drizzle-orm/pg-core'
import type { EntityToolkit } from '../../lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import z from 'zod'

import env from '@/shared/config/server-env'
import { intakeModes } from '@/shared/constants/enums'
import { pipelines } from '@/shared/constants/enums/pipelines'
import { buildFilterWhere } from '@/shared/dal/server/lib/query/filters'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { buildOrderBy } from '@/shared/dal/server/lib/query/sort'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { addCustomerNote } from '@/shared/entities/customers/dal/server/mutations'
import { derivedPipelineSql, derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { toDigits } from '@/shared/lib/phone'
import { constructionDataService } from '@/shared/services/construction-data.service'
import { customerIntakeService } from '@/shared/services/customer-intake.service'

import { createTRPCRouter } from '../../init'

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const intakeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'intake:submit',
})

export function createCustomerBusinessRouter(entity: EntityToolkit<PgTable>) {
  return createTRPCRouter({
    // Server-paginated customers list. Drives /dashboard/customers and the
    // lead-sources-admin "All customers" pane. Each row carries its joined
    // leadSource (name + slug); NULL joins mean "unknown legacy import".
    // The `pipeline` field is the derived 5-bucket classification — the
    // physical 3-bucket DB column is exploded via `derivedPipelineSql`.
    list: entity.authedProcedure
      .input(paginatedQueryInput({
        pipeline: z.array(z.enum(pipelines)).optional(),
        createdAt: dateRangeSchema.optional(),
      }))
      .query(async ({ ctx, input }) => {
        const searchWhere = buildSearchWhere(input.search, [customers.name, customers.email])
        const filterWhere = buildFilterWhere(input.filters, {
          pipeline: v => derivedPipelineWhere(v),
          createdAt: v => and(
            v.from ? gte(customers.createdAt, v.from) : undefined,
            v.to ? lte(customers.createdAt, v.to) : undefined,
          ),
        })
        const where = and(ctx.scope ?? undefined, searchWhere, filterWhere)

        // Pipeline is intentionally not sortable — the registry omits the
        // header click affordance because the visible value is derived,
        // and ordering by the underlying 3-bucket column would surprise.
        const orderBy = buildOrderBy(input.sort, {
          name: customers.name,
          email: customers.email,
          createdAt: customers.createdAt,
          leadSourceName: leadSourcesTable.name,
        }, desc(customers.createdAt))

        return paginate({
          query: () => db
            .select({
              id: customers.id,
              name: customers.name,
              email: customers.email,
              createdAt: customers.createdAt,
              pipeline: derivedPipelineSql(),
              leadSourceId: customers.leadSourceId,
              leadSourceName: leadSourcesTable.name,
              leadSourceSlug: leadSourcesTable.slug,
            })
            .from(customers)
            .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
            .where(where)
            .orderBy(...orderBy)
            .limit(input.pagination.limit)
            .offset(input.pagination.offset),
          count: () => db.$count(customers, where),
        })
      }),

    // Search customers by name (agents) or name + phone (super-admins). Phone
    // is returned gated — agents only see it once a proposal has been sent for
    // the customer. See canAgentSeePhone / phone-gating-sql.
    search: entity.authedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        // isOmni drives the phone-column gating and the agent-vs-super-admin
        // text WHERE clause — legitimate non-visibility use of ability.can.
        // see ../../../shared/entities/customers/DOCS.md#phone-visibility-threshold
        const isOmni = ctx.ability.can('manage', 'all')
        const q = `%${input.query}%`
        // Phone is stored canonical 10-digit — strip the query to digits so a
        // formatted/E.164 search term still matches (see @/shared/lib/phone).
        const phoneDigits = toDigits(input.query)
        // Super-admins can also match by phone — agents cannot (they'd leak
        // which customers exist at which numbers).
        const textWhere = isOmni
          ? or(
              ilike(customers.name, q),
              ilike(customers.phone, phoneDigits ? `%${phoneDigits}%` : q),
            )
          : ilike(customers.name, q)
        return db
          .select({
            id: customers.id,
            name: customers.name,
            phone: gatedPhoneSql(isOmni),
            hasSentProposal: hasSentProposalSql(),
            address: customers.address,
          })
          .from(customers)
          .where(and(textWhere, ctx.scope ?? undefined))
          .limit(10)
      }),

    // Add a note to a customer — any agent
    addNote: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        content: z.string().min(1).max(2000),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await addCustomerNote({
          customerId: input.customerId,
          content: input.content,
          authorId: ctx.session.user.id,
        })
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add note.' })
        }
        return result.data
      }),

    // Public intake form submission — creates customer + optional note (+ meeting)
    createFromIntake: entity.publicProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        address: z.string().optional(),
        city: z.string().min(1),
        state: z.string().length(2).optional(),
        zip: z.string().min(1),
        email: z.string().optional(),
        notes: z.string().optional(),
        mode: z.enum(intakeModes),
        leadSourceSlug: z.string().optional(),
        leadMetaJSON: leadMetaSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { notes, mode, leadSourceSlug, ...customerData } = input

        // Rate limit by IP
        const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
        const { success } = await intakeRatelimit.limit(ip)
        if (!success) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
        }

        if (mode === 'customer_and_meeting' && !customerData.leadMetaJSON?.scheduledFor) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'A meeting must have a scheduled date.' })
        }

        const session = (ctx as { session?: { user: { id: string } } }).session ?? null

        // Resolve picked app-trade ids → human-readable NAMES for the envelope
        // (D10). Exact lookup (the human picked real app trades), not fuzzy.
        const pickedTradeIds = customerData.leadMetaJSON?.requestedTrades?.map(t => t.tradeId) ?? []
        let interestedTradesRaw: string[] | undefined
        if (pickedTradeIds.length > 0) {
          const allTrades = await constructionDataService.getTrades()
          const nameById = new Map(allTrades.map(t => [t.id, t.name]))
          interestedTradesRaw = pickedTradeIds.map(id => nameById.get(id)).filter((n): n is string => Boolean(n))
        }

        const leadMeta = customerData.leadMetaJSON
          ? { ...customerData.leadMetaJSON, ...(interestedTradesRaw ? { interestedTradesRaw } : {}) }
          : (interestedTradesRaw ? { interestedTradesRaw } : undefined)

        // Resolve meeting owner (session, else info@ fallback) — business rule
        // with session context stays in the router.
        let meeting: { ownerId: string } | null = null
        if (mode === 'customer_and_meeting') {
          let ownerId = session?.user.id
          if (!ownerId) {
            const [fallbackUser] = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.email, 'info@triprosremodeling.com'))
              .limit(1)
            if (!fallbackUser) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Fallback meeting owner not found. Contact an administrator.' })
            }
            ownerId = fallbackUser.id
          }
          meeting = { ownerId: ownerId! }
        }

        const result = await customerIntakeService.ingestLead(SYSTEM_CONTEXT, {
          core: {
            name: customerData.name,
            phone: customerData.phone,
            email: customerData.email ?? null,
            address: customerData.address ?? null,
            city: customerData.city,
            state: customerData.state ?? null,
            zip: customerData.zip,
            leadSourceSlug: leadSourceSlug ?? 'manual',
          },
          leadMeta,
          note: notes ?? null,
          meeting,
        })

        if (!result.success) {
          if (result.error.type === 'not-found') {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Lead source "${leadSourceSlug ?? 'manual'}" not found. Contact an administrator.` })
          }
          console.error('[createFromIntake] ingest failed:', result.error)
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Customer could not be saved (or the meeting could not be scheduled). Add it manually from the customer profile.' })
        }

        return { customerId: result.data.customer.id, meetingId: result.data.meetingId }
      }),
  })
}
