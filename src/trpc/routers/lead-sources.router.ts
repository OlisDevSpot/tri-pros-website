import { randomBytes } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { and, asc, countDistinct, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import z from 'zod'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'

import { agentProcedure, createTRPCRouter } from '../init'

// ── Helpers ─────────────────────────────────────────────────────────────────

function requireSuperAdmin(role: string): void {
  if (role !== 'super-admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super-admin access required.' })
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'source'
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    const [existing] = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, candidate))
      .limit(1)
    if (!existing) {
      return candidate
    }
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not generate unique slug.' })
}

function generateToken(): string {
  return randomBytes(16).toString('hex')
}

// Match customers to a lead source by FK. Callers pass the lead_sources.id.
function customersMatchingSource(leadSourceId: string) {
  return eq(customers.leadSourceId, leadSourceId)
}

// ── Schemas ─────────────────────────────────────────────────────────────────

const timeRangeInput = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

const createInput = z.object({
  name: z.string().min(1).max(120),
  formConfigJSON: leadSourceFormConfigSchema,
})

const updateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  formConfigJSON: leadSourceFormConfigSchema.optional(),
  isActive: z.boolean().optional(),
})

// ── Router ──────────────────────────────────────────────────────────────────

export const leadSourcesRouter = createTRPCRouter({
  // List of all lead sources with compact stats for the left-pane picker.
  // The optional time range scopes `leadsInRange` so the list reacts to the
  // global time picker in the page header. When absent, `leadsInRange`
  // degrades to `totalLeads`.
  list: agentProcedure
    .input(z.object({
      includeInactive: z.boolean().default(true),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const includeInactive = input?.includeInactive ?? true

      // Interpolating an empty Drizzle `sql` fragment into a correlated
      // subquery can silently zero out the count (witnessed on "All time"
      // → every leadsInRange came back 0). Always interpolate a real ISO
      // string — fall back to epoch/far-future sentinels when the
      // corresponding boundary is absent so the predicate stays a no-op.
      const effectiveFrom = input?.from ?? '1970-01-01T00:00:00.000Z'
      const effectiveTo = input?.to ?? '2999-12-31T23:59:59.999Z'

      const rows = await db
        .select({
          id: leadSourcesTable.id,
          name: leadSourcesTable.name,
          slug: leadSourcesTable.slug,
          token: leadSourcesTable.token,
          isActive: leadSourcesTable.isActive,
          createdAt: leadSourcesTable.createdAt,
          updatedAt: leadSourcesTable.updatedAt,
          totalLeads: sql<number>`(
            SELECT COUNT(*)::int FROM ${customers}
            WHERE ${customers.leadSourceId} = ${leadSourcesTable.id}
          )`,
          leadsInRange: sql<number>`(
            SELECT COUNT(*)::int FROM ${customers}
            WHERE ${customers.leadSourceId} = ${leadSourcesTable.id}
              AND ${customers.createdAt} >= ${effectiveFrom}
              AND ${customers.createdAt} <= ${effectiveTo}
          )`,
        })
        .from(leadSourcesTable)
        .where(includeInactive ? undefined : eq(leadSourcesTable.isActive, true))
        .orderBy(desc(leadSourcesTable.isActive), asc(leadSourcesTable.name))

      return rows
    }),

  getById: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const [row] = await db
        .select()
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.id, input.id))
        .limit(1)
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
      }
      return row
    }),

  // Performance stats for a single lead source over a time range.
  // Stats: total leads (all-time), leads within range, signed proposals (all-time).
  getStats: agentProcedure
    .input(z.object({ id: z.string().uuid() }).merge(timeRangeInput))
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const [src] = await db
        .select({ id: leadSourcesTable.id })
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.id, input.id))
        .limit(1)
      if (!src) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
      }

      const rangeFrom = input.from ? new Date(input.from) : null
      const rangeTo = input.to ? new Date(input.to) : null

      const baseMatch = customersMatchingSource(src.id)

      const rangeClauses = [
        rangeFrom ? gte(customers.createdAt, rangeFrom.toISOString()) : undefined,
        rangeTo ? lte(customers.createdAt, rangeTo.toISOString()) : undefined,
      ].filter(Boolean)

      const [totalRow] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(customers)
        .where(baseMatch)

      const [rangeRow] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(customers)
        .where(rangeClauses.length > 0 ? and(baseMatch, ...rangeClauses) : baseMatch)

      // Proposals link to customers via meetings.customerId, not directly.
      // Chain: customers → meetings → proposals. DISTINCT customer id so a
      // customer with multiple approved proposals counts once.
      const [signedRow] = await db
        .select({ count: countDistinct(customers.id).mapWith(Number) })
        .from(customers)
        .innerJoin(meetings, eq(meetings.customerId, customers.id))
        .innerJoin(proposals, eq(proposals.meetingId, meetings.id))
        .where(and(baseMatch, eq(proposals.status, 'approved')))

      return {
        total: totalRow?.count ?? 0,
        range: rangeRow?.count ?? 0,
        signedProposals: signedRow?.count ?? 0,
      }
    }),

  // Aggregate performance across every lead source. Mirrors getStats shape so
  // the PerformanceStrip renders identically for the "All" pane and per-source
  // panes. `total` counts every customer (including legacy NULL-source rows);
  // `range` applies the time window; `signedProposals` is DISTINCT customers
  // with an approved proposal.
  getAggregateStats: agentProcedure
    .input(timeRangeInput)
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)

      const rangeFrom = input.from ? new Date(input.from) : null
      const rangeTo = input.to ? new Date(input.to) : null
      const rangeClauses = [
        rangeFrom ? gte(customers.createdAt, rangeFrom.toISOString()) : undefined,
        rangeTo ? lte(customers.createdAt, rangeTo.toISOString()) : undefined,
      ].filter(Boolean)

      const [totalRow] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(customers)

      const rangeQuery = db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(customers)
      const [rangeRow] = rangeClauses.length > 0
        ? await rangeQuery.where(and(...rangeClauses))
        : await rangeQuery

      const [signedRow] = await db
        .select({ count: countDistinct(customers.id).mapWith(Number) })
        .from(customers)
        .innerJoin(meetings, eq(meetings.customerId, customers.id))
        .innerJoin(proposals, eq(proposals.meetingId, meetings.id))
        .where(eq(proposals.status, 'approved'))

      return {
        total: totalRow?.count ?? 0,
        range: rangeRow?.count ?? 0,
        signedProposals: signedRow?.count ?? 0,
      }
    }),

  // Dynamic list of years with at least one customer for any lead source.
  // Used to build time-range chips (2026, 2025, …).
  getYearsWithActivity: agentProcedure
    .query(async ({ ctx }) => {
      requireSuperAdmin(ctx.session.user.role)
      const rows = await db
        .select({
          year: sql<number>`EXTRACT(YEAR FROM ${customers.createdAt})::int`,
        })
        .from(customers)
        .groupBy(sql`EXTRACT(YEAR FROM ${customers.createdAt})`)
        .orderBy(sql`EXTRACT(YEAR FROM ${customers.createdAt}) DESC`)
      return rows.map(r => r.year)
    }),

  // Customers sourced from a given lead source. Paginated for future scale.
  getCustomers: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const [src] = await db
        .select({ id: leadSourcesTable.id })
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.id, input.id))
        .limit(1)
      if (!src) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
      }

      const match = customersMatchingSource(src.id)
      const where = input.search
        ? and(
            match,
            or(
              ilike(customers.name, `%${input.search}%`),
              ilike(customers.email, `%${input.search}%`),
            ),
          )
        : match

      return db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          createdAt: customers.createdAt,
          pipeline: customers.pipeline,
        })
        .from(customers)
        .where(where)
        .orderBy(desc(customers.createdAt))
        .limit(input.limit)
        .offset(input.offset)
    }),

  // Customers across every lead source (plus legacy NULL-source rows). Used by
  // the "All" pane. Joins lead_sources so the table can show which source
  // each customer came from; NULL joins mean "unknown legacy import".
  getAllCustomers: agentProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)

      const where = input.search
        ? or(
            ilike(customers.name, `%${input.search}%`),
            ilike(customers.email, `%${input.search}%`),
          )
        : undefined

      return db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          createdAt: customers.createdAt,
          pipeline: customers.pipeline,
          leadSourceId: customers.leadSourceId,
          leadSourceName: leadSourcesTable.name,
          leadSourceSlug: leadSourcesTable.slug,
        })
        .from(customers)
        .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
        .where(where)
        .orderBy(desc(customers.createdAt))
        .limit(input.limit)
        .offset(input.offset)
    }),

  create: agentProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const slug = await generateUniqueSlug(input.name)
      const token = generateToken()
      const [created] = await db
        .insert(leadSourcesTable)
        .values({ name: input.name, slug, token, formConfigJSON: input.formConfigJSON, isActive: true })
        .returning()
      if (!created) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create lead source.' })
      }
      return created
    }),

  update: agentProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const { id, ...rest } = input
      const [updated] = await db
        .update(leadSourcesTable)
        .set(rest)
        .where(eq(leadSourcesTable.id, id))
        .returning()
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
      }
      return updated
    }),

  rotateToken: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const [updated] = await db
        .update(leadSourcesTable)
        .set({ token: generateToken() })
        .where(eq(leadSourcesTable.id, input.id))
        .returning()
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
      }
      return updated
    }),

  duplicate: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const [source] = await db
        .select()
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.id, input.id))
        .limit(1)
      if (!source) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
      }
      const newName = `${source.name} (copy)`
      const newSlug = await generateUniqueSlug(newName)
      const [created] = await db
        .insert(leadSourcesTable)
        .values({
          name: newName,
          slug: newSlug,
          token: generateToken(),
          formConfigJSON: source.formConfigJSON,
          isActive: false,
        })
        .returning()
      if (!created) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to duplicate.' })
      }
      return created
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      await db.delete(leadSourcesTable).where(eq(leadSourcesTable.id, input.id))
      return { success: true as const }
    }),
})
