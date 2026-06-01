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
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { buildFilterWhere } from '@/shared/dal/server/lib/query/filters'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { buildOrderBy } from '@/shared/dal/server/lib/query/sort'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetings } from '@/shared/db/schema/meetings'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { derivedPipelineSql, derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'

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
        // Super-admins can also match by phone — agents cannot (they'd leak
        // which customers exist at which numbers).
        const textWhere = isOmni
          ? or(ilike(customers.name, q), ilike(customers.phone, q))
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
        const [note] = await db
          .insert(customerNotes)
          .values({
            customerId: input.customerId,
            content: input.content,
            authorId: ctx.session.user.id,
          })
          .returning()

        return note
      }),

    // Public intake form submission — creates customer + optional note
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

        // Resolve session for meeting owner assignment (null for unauthenticated 3rd party)
        const session = (ctx as { session?: { user: { id: string } } }).session ?? null

        // Resolve lead source FK: slug -> id, defaulting to 'manual' when absent.
        // Public 3rd-party forms pass their own slug; dashboard manual adds omit it.
        const resolveSlug = leadSourceSlug ?? 'manual'
        const [leadSourceRow] = await db
          .select({ id: leadSourcesTable.id })
          .from(leadSourcesTable)
          .where(eq(leadSourcesTable.slug, resolveSlug))
          .limit(1)

        if (!leadSourceRow) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Lead source "${resolveSlug}" not found. Contact an administrator.`,
          })
        }

        // 1. Create customer through the canonical DAL — fires spec.hooks.create.*
        //    if defined (none today). SYSTEM_CONTEXT is the correct context label
        //    for an unauthenticated public-form caller: createImpl in createCrudDal
        //    has no CASL/scope gates today, but any future create-side gate or hook
        //    that consults ctx will see a consistent null session/ability.
        const customer = dalVerifySuccess(
          await customerCrud.create(SYSTEM_CONTEXT, {
            ...customerData,
            zip: customerData.zip || '',
            leadSourceId: leadSourceRow.id,
          }),
        )

        // 2. Insert note (best-effort — no longer atomic with the customer
        //    insert, but notes are optional and a failed note doesn't justify
        //    rolling back the customer that the user just successfully submitted).
        if (notes) {
          await db.insert(customerNotes).values({
            customerId: customer.id,
            content: notes,
            authorId: session?.user.id ?? null,
          })
        }

        // 3. Create meeting when mode is customer_and_meeting. Sequential,
        //    not transactional with the customer/note phase above — the
        //    customer is already committed, and a meeting failure here
        //    surfaces as a 500 to the caller without rolling back the
        //    customer they just submitted.
        let meetingId: string | null = null
        if (mode === 'customer_and_meeting') {
          let ownerId = session?.user.id

          // Fallback: assign to info@triprosremodeling.com for unauthenticated
          // submissions. Read-only lookup, no atomicity requirement — stays
          // outside the meeting/participant transaction below.
          if (!ownerId) {
            const [fallbackUser] = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.email, 'info@triprosremodeling.com'))
              .limit(1)

            if (!fallbackUser) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Fallback meeting owner not found. Contact an administrator.',
              })
            }

            ownerId = fallbackUser.id
          }

          // TODO: route through meetingCrud.create once meetingServerSpec.hooks.create
          // no longer hard-codes ctx.session!.user.id (it currently crashes for
          // unauthenticated public-form callers). Until then, this path is asymmetric:
          // customer creates fire customerCrud.create's spec hooks, but meeting creates
          // are inline DAL and bypass any meeting spec hooks.
          // Wrap meeting insert + owner-participant insert in a transaction so
          // a meeting never exists without its owner participant (invariant:
          // every meeting has >=1 owner participant).
          meetingId = await db.transaction(async (tx) => {
            const [meeting] = await tx
              .insert(meetings)
              .values({
                ownerId,
                customerId: customer.id,
                meetingType: 'Fresh',
                scheduledFor: customerData.leadMetaJSON?.scheduledFor ?? undefined,
              })
              .returning()

            if (!meeting) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create meeting' })
            }

            // Mirror ownership in the participant junction table so every
            // meeting has >=1 owner participant (intake parity with meetings.create).
            await addParticipant(meeting.id, ownerId!, 'owner', tx)

            return meeting.id
          })
        }

        return { customerId: customer.id, meetingId }
      }),
  })
}
