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
import { getCustomer, listCustomers } from '@/shared/entities/customers/dal/server/queries'
import { derivedPipelineSql, derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerProfileSchema, financialProfileSchema, leadMetaSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { geocodeAddress } from '@/shared/services/providers/google-maps/geocode'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

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
    // Fetch all locally-cached customers
    getAll: entity.authedProcedure
      .query(async ({ ctx }) => {
        return dalToTrpc(await listCustomers(ctx))
      }),

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

    // Fetch a single customer by internal UUID
    getById: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return dalToTrpc(await getCustomer(ctx, { id: input.customerId }))
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

    // Update customer profile JSONB fields (used during meeting intake).
    // Routes through customerCrud.update — spec.update.jsonbMergeColumns
    // deep-merges customerProfileJSON / propertyProfileJSON /
    // financialProfileJSON so partial updates don't overwrite existing keys.
    // see ../../../shared/entities/customers/DOCS.md#three-jsonb-profiles
    //
    // Calls customerCrud.update (the DAL function) directly, which bypasses
    // the omni-gate that sits on the crud sub-router's `update` slot. That
    // gate protects the public `crud.update` tRPC surface against agent
    // field-bypass; this procedure is the legitimate agent path for the
    // three JSONB profile columns and the Zod input schema above already
    // restricts callers to those exact keys, so per-field CASL is preserved
    // at the router boundary.
    updateProfile: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        customerProfileJSON: customerProfileSchema.optional(),
        propertyProfileJSON: propertyProfileSchema.optional(),
        financialProfileJSON: financialProfileSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { customerId, ...profiles } = input
        return dalToTrpc(await customerCrud.update(ctx, { id: customerId, data: profiles }))
      }),

    // Overwrite a customer's `createdAt` — super-admin only. Legacy Notion
    // imports land with today's timestamp regardless of when the lead
    // actually came in, so lead-source stats by range are misleading until
    // the super-admin corrects them. Lead-source stats depend on this
    // column, so the caller should invalidate both customer + lead-source
    // queries on success.
    updateCreatedAt: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        createdAt: z.string().datetime(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.ability.cannot('update', 'Customer', 'createdAt')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to edit the created date.' })
        }
        const row = dalToTrpc(await customerCrud.update(ctx, {
          id: input.customerId,
          data: { createdAt: input.createdAt },
        }))
        return { id: row.id, createdAt: row.createdAt }
      }),

    // Reassign a customer's lead source — super-admin only. The leadSourceId
    // column drives every lead-source attribution stat (totals, signed counts,
    // per-source customer lists), so changing it must invalidate both
    // customer and lead-source query trees on the client.
    updateLeadSource: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        leadSourceId: z.string().uuid(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.ability.cannot('update', 'Customer', 'leadSourceId')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to change the lead source.' })
        }
        // Validate target lead source exists (FK check would also catch it,
        // but a clean 404 beats a Postgres FK error)
        const [target] = await db
          .select({ name: leadSourcesTable.name, slug: leadSourcesTable.slug })
          .from(leadSourcesTable)
          .where(eq(leadSourcesTable.id, input.leadSourceId))
          .limit(1)
        if (!target) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found' })
        }
        const updated = dalToTrpc(await customerCrud.update(ctx, {
          id: input.customerId,
          data: { leadSourceId: input.leadSourceId },
        }))
        return {
          id: updated.id,
          leadSourceId: updated.leadSourceId,
          leadSourceName: target.name,
          leadSourceSlug: target.slug,
        }
      }),

    // Update top-level contact fields — gated per-field via CASL so the
    // permission boundary stays in `abilities.ts`. Today only super-admin
    // (`manage all`) passes; agents are field-restricted to JSONB profile
    // blobs and so cannot touch any of these top-level columns.
    updateCustomerContact: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().length(2).optional(),
        zip: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { customerId, ...fields } = input
        const updateData: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) {
            continue
          }
          if (ctx.ability.cannot('update', 'Customer', key)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: `You do not have permission to update ${key}.` })
          }
          updateData[key] = value
        }
        if (Object.keys(updateData).length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' })
        }
        // Invalidate cached geocode whenever address components change.
        // see ../../../shared/entities/customers/DOCS.md#geocoding-stored-on-customer
        const addressChanged = ['address', 'city', 'state', 'zip'].some(k => k in updateData)
        if (addressChanged) {
          updateData.latitude = null
          updateData.longitude = null
          updateData.geocodedAt = null
        }
        return dalToTrpc(await customerCrud.update(ctx, { id: customerId, data: updateData }))
      }),

    // Lazy geocode — returns cached coords or geocodes once, persists, and returns.
    // Zero Google API calls after the first successful geocode per customer.
    ensureGeocoded: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .query(async ({ input }) => {
        const [customer] = await db
          .select({
            id: customers.id,
            name: customers.name,
            address: customers.address,
            city: customers.city,
            state: customers.state,
            zip: customers.zip,
            latitude: customers.latitude,
            longitude: customers.longitude,
          })
          .from(customers)
          .where(eq(customers.id, input.customerId))
          .limit(1)

        if (!customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
        }

        if (customer.latitude != null && customer.longitude != null) {
          console.warn(`[ensureGeocoded] cache hit for ${customer.name} (${customer.id})`)
          return { latitude: customer.latitude, longitude: customer.longitude }
        }

        // Try progressively broader queries. The street address is the most
        // precise; if Google can't resolve it (typos, unusual format, etc.),
        // fall back to city+state+zip and finally state+zip so the hero can
        // still render a useful neighborhood view.
        const candidates = [
          [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', '),
          [customer.city, customer.state, customer.zip].filter(Boolean).join(', '),
          [customer.state, customer.zip].filter(Boolean).join(' '),
        ].filter(q => q.length > 0)

        console.warn(`[ensureGeocoded] ${customer.name} — raw fields:`, {
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zip: customer.zip,
        })
        console.warn(`[ensureGeocoded] candidates:`, candidates)

        if (candidates.length === 0) {
          console.warn(`[ensureGeocoded] no candidates for customer ${customer.id}`)
          return null
        }

        const geocoded = await geocodeAddress(candidates)
        if (!geocoded) {
          return null
        }

        await db
          .update(customers)
          .set({
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            geocodedAt: new Date().toISOString(),
          })
          .where(eq(customers.id, input.customerId))

        return geocoded
      }),

    // Permanently delete a customer + their meetings, proposals, notes, and
    // projects. CASL-gated to `delete Customer` — only super-admin (`manage all`)
    // currently has this permission. UI must confirm before invoking.
    // Cascade (proposals → meetings before customer) runs in
    // customerServerSpec.hooks.delete.before; customer_notes and projects
    // cascade via schema FKs.
    delete: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability.cannot('delete', 'Customer')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to delete customers.' })
        }
        dalToTrpc(await customerCrud.delete(ctx, { id: input.customerId }))
        return { success: true as const }
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
