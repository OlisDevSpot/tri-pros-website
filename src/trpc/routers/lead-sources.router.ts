import { TRPCError } from '@trpc/server'
import { differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, max as maxDate, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm'
import z from 'zod'

import { customerPipelines } from '@/shared/constants/enums/customer-pipelines'
import { buildFilterWhere } from '@/shared/dal/server/query/filters'
import { paginate } from '@/shared/dal/server/query/output'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/query/schemas'
import { buildSearchWhere } from '@/shared/dal/server/query/search'
import { buildOrderBy } from '@/shared/dal/server/query/sort'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'
import { customerSegments } from '@/shared/entities/lead-sources/constants/customer-segments'
import { buildSegmentWhere } from '@/shared/entities/lead-sources/lib/segment-sql'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { generateToken } from '@/shared/lib/generate-token'
import { slugify } from '@/shared/lib/slugify'

import { agentProcedure, createTRPCRouter } from '../init'

// ── Helpers ─────────────────────────────────────────────────────────────────

function requireSuperAdmin(role: string): void {
  if (role !== 'super-admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super-admin access required.' })
  }
}

async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base, { maxLen: 64 }) || 'source'
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

// Match customers to a lead source by FK. Callers pass the lead_sources.id.
function customersMatchingSource(leadSourceId: string) {
  return eq(customers.leadSourceId, leadSourceId)
}

// Build the optional [gte(from), lte(to)] predicate pair against customers.createdAt.
// Returned array is spread-friendly: `and(baseMatch, ...customerCreatedAtInRange(…))`.
function customerCreatedAtInRange(from?: string, to?: string) {
  return [
    from ? gte(customers.createdAt, from) : undefined,
    to ? lte(customers.createdAt, to) : undefined,
  ].filter(Boolean)
}

type Bucket = 'day' | 'week' | 'month'

// Pick the trend-chart bucket size from the resolved date range.
// Matches the spec's "≤14 day, ≤95 week, else month" thresholds.
function selectBucket(from?: string, to?: string): Bucket {
  if (!from || !to) {
    return 'month'
  }
  const days = Math.abs(differenceInCalendarDays(new Date(to), new Date(from)))
  if (days <= 14) {
    return 'day'
  }
  if (days <= 95) {
    return 'week'
  }
  return 'month'
}

// Truncate a JS Date to the start of its bucket (matches Postgres date_trunc).
function truncateToBucket(d: Date, bucket: Bucket): Date {
  switch (bucket) {
    case 'day':
      return startOfDay(d)
    case 'week':
      // Postgres date_trunc('week', …) snaps to Monday (ISO week start).
      return startOfWeek(d, { weekStartsOn: 1 })
    case 'month':
      return startOfMonth(d)
  }
}

// Enumerate every bucket between `from` and `to` (inclusive) so the trend
// series can be backfilled with zeros for empty buckets.
function enumerateBuckets(from: Date, to: Date, bucket: Bucket): Date[] {
  const start = truncateToBucket(from, bucket)
  const end = truncateToBucket(to, bucket)
  if (end < start) {
    return [start]
  }
  switch (bucket) {
    case 'day':
      return eachDayOfInterval({ start, end })
    case 'week':
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
    case 'month':
      return eachMonthOfInterval({ start, end })
  }
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
  slug: z.string().min(1).max(64).optional(),
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

      const rangePredicates = customerCreatedAtInRange(input?.from, input?.to)
      const rangePredicate = rangePredicates.length > 0 ? and(...rangePredicates) : undefined
      const totalLeads = sql<number>`COUNT(${customers.id})::int`

      const rows = await db
        .select({
          id: leadSourcesTable.id,
          name: leadSourcesTable.name,
          slug: leadSourcesTable.slug,
          token: leadSourcesTable.token,
          isActive: leadSourcesTable.isActive,
          createdAt: leadSourcesTable.createdAt,
          updatedAt: leadSourcesTable.updatedAt,
          totalLeads,
          leadsInRange: rangePredicate
            ? sql<number>`COUNT(${customers.id}) FILTER (WHERE ${rangePredicate})::int`
            : totalLeads,
        })
        .from(leadSourcesTable)
        .leftJoin(customers, eq(customers.leadSourceId, leadSourcesTable.id))
        .where(and(
          isNull(leadSourcesTable.archivedAt),
          includeInactive ? undefined : eq(leadSourcesTable.isActive, true),
        ))
        .groupBy(leadSourcesTable.id)
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
  // Stats: total leads (all-time), leads within range, signed customers (all-time).
  // "Signed" is defined by `isSignedCustomerSql` (customer has ≥1 project).
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

      const baseMatch = customersMatchingSource(src.id)
      const rangeClauses = customerCreatedAtInRange(input.from, input.to)
      const rangeWhere = rangeClauses.length > 0
        ? and(baseMatch, ...rangeClauses)
        : baseMatch

      const [total, range, signedCustomers, approvedProposals] = await Promise.all([
        db.$count(customers, baseMatch),
        db.$count(customers, rangeWhere),
        db.$count(customers, and(baseMatch, isSignedCustomerSql())),
        // Approved proposals belonging to customers from this lead source.
        // Hydrate fundingJSON only — no SQL-side TCP extraction. Aggregate via
        // computeFinalTcp + computeProjectValue semantics (sum approved values).
        db
          .select({ fundingJSON: proposals.fundingJSON })
          .from(proposals)
          .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
          .innerJoin(customers, eq(customers.id, meetings.customerId))
          .where(and(eq(customers.leadSourceId, src.id), eq(proposals.status, 'approved'))),
      ])

      let totalSales = 0
      for (const p of approvedProposals) {
        totalSales += computeFinalTcp(p.fundingJSON.data)
      }
      totalSales = Math.round(totalSales)

      // totalSales is lifetime by design (Phase 1) — the time-range filter
      // scopes `range` only. Range-scoped revenue can land in Phase 2.
      return { total, range, signedCustomers, totalSales }
    }),

  // Aggregate performance across every lead source. Mirrors getStats shape so
  // the PerformanceStrip renders identically for the "All" pane and per-source
  // panes. `total` counts every customer (including legacy NULL-source rows);
  // `range` applies the time window; `signedCustomers` counts customers with
  // at least one project (see `isSignedCustomerSql`).
  getAggregateStats: agentProcedure
    .input(timeRangeInput)
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)

      const rangeClauses = customerCreatedAtInRange(input.from, input.to)
      const rangeWhere = rangeClauses.length > 0 ? and(...rangeClauses) : undefined

      const [total, range, signedCustomers] = await Promise.all([
        db.$count(customers),
        db.$count(customers, rangeWhere),
        db.$count(customers, isSignedCustomerSql()),
      ])

      return { total, range, signedCustomers }
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

  // Customers sourced from a given lead source. Paginated via shared schema.
  // Filters: `pipeline` (multi-select active|rehash|dead), `createdAt` (date range).
  // Top-level `segment` narrows results to 'all' | 'active' | 'signed' | 'dead'
  // without exposing the control in the QueryToolbar filter row.
  getCustomers: agentProcedure
    .input(paginatedQueryInput({
      pipeline: z.array(z.enum(customerPipelines)).optional(),
      createdAt: dateRangeSchema.optional(),
    }).extend({
      id: z.string().uuid(),
      segment: z.enum(customerSegments).optional(),
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
      const searchWhere = buildSearchWhere(input.search, [customers.name, customers.email])
      const filterWhere = buildFilterWhere(input.filters, {
        pipeline: v => (v.length > 0 ? inArray(customers.pipeline, v) : undefined),
        createdAt: v => and(
          v.from ? gte(customers.createdAt, v.from) : undefined,
          v.to ? lte(customers.createdAt, v.to) : undefined,
        ),
      })
      const segmentWhere = buildSegmentWhere(input.segment)
      const where = and(match, searchWhere, filterWhere, segmentWhere)

      const orderBy = buildOrderBy(input.sort, {
        name: customers.name,
        email: customers.email,
        createdAt: customers.createdAt,
        pipeline: customers.pipeline,
      }, desc(customers.createdAt))

      return paginate({
        // Source fields are joined so the row carries the same shape as
        // `customersRouter.list` — the shared `LeadSourceCell` then renders
        // an editable picker. Reassigning here removes the row from the
        // list (it no longer matches `match`), which is the desired UX.
        query: () => db
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
          .orderBy(...orderBy)
          .limit(input.pagination.limit)
          .offset(input.pagination.offset),
        count: () => db.$count(customers, where),
      })
    }),

  getStatusCounts: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
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
      const [all, active, signed, dead] = await Promise.all([
        db.$count(customers, match),
        db.$count(customers, and(match, buildSegmentWhere('active'))),
        db.$count(customers, and(match, buildSegmentWhere('signed'))),
        db.$count(customers, and(match, buildSegmentWhere('dead'))),
      ])

      return { all, active, signed, dead }
    }),

  // Funnel + trend for the Analytics tab. One round-trip — both visualizations
  // share the same (lead-source, range) scope. Trend buckets are picked
  // server-side so axis labels and tooltips stay consistent across renders.
  getAnalytics: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
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

      const baseMatch = customersMatchingSource(src.id)

      // Resolve the trend's lower bound up front. When the chip is "all" we
      // need a concrete window so bucket selection + backfill have something
      // to work with — the lower bound becomes the source's first lead.
      let resolvedFrom = input.from
      const resolvedTo = input.to ?? new Date().toISOString()
      if (!resolvedFrom) {
        const [{ minCreatedAt } = { minCreatedAt: null }] = await db
          .select({ minCreatedAt: sql<string | null>`MIN(${customers.createdAt})` })
          .from(customers)
          .where(baseMatch)
        resolvedFrom = minCreatedAt ?? resolvedTo
      }

      const bucket = selectBucket(resolvedFrom, resolvedTo)

      // Customer-creation range predicates (both funnel + trend leads use this).
      const customerRange = customerCreatedAtInRange(input.from, input.to)
      const leadsWhere = and(baseMatch, ...customerRange)

      // Range predicates for the event-side filters (meetings.scheduledFor,
      // proposals.createdAt, projects.createdAt). Each is filtered to the
      // chip's window so a customer who booked a meeting outside the range
      // does not contribute to that step.
      const meetingRangeWhere = and(
        input.from ? gte(meetings.scheduledFor, input.from) : undefined,
        input.to ? lte(meetings.scheduledFor, input.to) : undefined,
      )
      const proposalRangeWhere = and(
        input.from ? gte(proposals.createdAt, input.from) : undefined,
        input.to ? lte(proposals.createdAt, input.to) : undefined,
      )
      const projectRangeWhere = and(
        input.from ? gte(projects.createdAt, input.from) : undefined,
        input.to ? lte(projects.createdAt, input.to) : undefined,
      )

      // ── Funnel ────────────────────────────────────────────────────────────
      // Each step narrows `leadsWhere` with an EXISTS-style `inArray`
      // subquery against the relevant event table. Drizzle has no `exists`
      // helper today, so subquery + inArray is the idiomatic alternative
      // (compiles to `WHERE … AND customers.id IN (SELECT … FROM …)`).
      const [leadsCount, meetingsBookedCount, proposalsSentCount, signedCount] = await Promise.all([
        db.$count(customers, leadsWhere),
        db.$count(
          customers,
          and(
            leadsWhere,
            inArray(
              customers.id,
              db
                .selectDistinct({ id: meetings.customerId })
                .from(meetings)
                .where(meetingRangeWhere),
            ),
          ),
        ),
        db.$count(
          customers,
          and(
            leadsWhere,
            inArray(
              customers.id,
              db
                .selectDistinct({ id: meetings.customerId })
                .from(meetings)
                .innerJoin(proposals, eq(proposals.meetingId, meetings.id))
                .where(and(
                  inArray(proposals.status, ['sent', 'approved']),
                  proposalRangeWhere,
                )),
            ),
          ),
        ),
        db.$count(
          customers,
          and(
            leadsWhere,
            inArray(
              customers.id,
              db
                .selectDistinct({ id: projects.customerId })
                .from(projects)
                .where(projectRangeWhere),
            ),
          ),
        ),
      ])

      // ── Trend (3 parallel queries → JS union) ─────────────────────────────
      // date_trunc requires the bucket name as a literal, not a bind parameter:
      // a bound $1 in SELECT and $3 in GROUP BY are not equated by the planner.
      // `bucket` is whitelisted to 'day' | 'week' | 'month' so sql.raw is safe.
      const bucketLiteral = sql.raw(`'${bucket}'`)
      const bucketLeads = sql<string>`date_trunc(${bucketLiteral}, ${customers.createdAt})`
      const bucketMeetings = sql<string>`date_trunc(${bucketLiteral}, ${meetings.scheduledFor})`
      const bucketProjects = sql<string>`date_trunc(${bucketLiteral}, ${projects.createdAt})`

      const [leadsByBucket, meetingsByBucket, signedByBucket] = await Promise.all([
        db
          .select({
            bucketStart: bucketLeads,
            count: sql<number>`COUNT(DISTINCT ${customers.id})::int`,
          })
          .from(customers)
          .where(leadsWhere)
          .groupBy(bucketLeads),
        db
          .select({
            bucketStart: bucketMeetings,
            count: sql<number>`COUNT(DISTINCT ${meetings.customerId})::int`,
          })
          .from(meetings)
          .innerJoin(customers, eq(customers.id, meetings.customerId))
          .where(and(baseMatch, meetingRangeWhere))
          .groupBy(bucketMeetings),
        db
          .select({
            bucketStart: bucketProjects,
            count: sql<number>`COUNT(DISTINCT ${projects.customerId})::int`,
          })
          .from(projects)
          .innerJoin(customers, eq(customers.id, projects.customerId))
          .where(and(baseMatch, projectRangeWhere))
          .groupBy(bucketProjects),
      ])

      // Union the three series by bucket-start. Backfill missing buckets with
      // zeros so the trend chart renders a continuous x-axis.
      interface TrendRow {
        bucketStart: string
        leads: number
        meetings: number
        signed: number
      }
      const trendMap = new Map<string, TrendRow>()

      // Determine the actual span of buckets to render. Use the resolved
      // window if available, otherwise widen to cover any observed data.
      const observedDates: Date[] = []
      for (const r of [...leadsByBucket, ...meetingsByBucket, ...signedByBucket]) {
        if (r.bucketStart) {
          observedDates.push(new Date(r.bucketStart))
        }
      }
      const fromDate = new Date(resolvedFrom)
      const toDate = new Date(resolvedTo)
      const lowerBound = observedDates.length > 0
        ? truncateToBucket(observedDates.reduce((a, b) => (a < b ? a : b), fromDate), bucket)
        : truncateToBucket(fromDate, bucket)
      const upperBound = truncateToBucket(maxDate([toDate, ...observedDates]), bucket)

      for (const date of enumerateBuckets(lowerBound, upperBound, bucket)) {
        const key = date.toISOString()
        trendMap.set(key, { bucketStart: key, leads: 0, meetings: 0, signed: 0 })
      }

      function bumpSeries(rows: Array<{ bucketStart: string, count: number }>, key: keyof Omit<TrendRow, 'bucketStart'>): void {
        for (const row of rows) {
          const truncated = truncateToBucket(new Date(row.bucketStart), bucket).toISOString()
          const existing = trendMap.get(truncated) ?? { bucketStart: truncated, leads: 0, meetings: 0, signed: 0 }
          existing[key] = row.count
          trendMap.set(truncated, existing)
        }
      }

      bumpSeries(leadsByBucket, 'leads')
      bumpSeries(meetingsByBucket, 'meetings')
      bumpSeries(signedByBucket, 'signed')

      const trend = Array.from(trendMap.values()).sort((a, b) => a.bucketStart.localeCompare(b.bucketStart))

      return {
        funnel: {
          leads: leadsCount,
          meetingsBooked: meetingsBookedCount,
          proposalsSent: proposalsSentCount,
          signed: signedCount,
        },
        trend,
        bucket,
      }
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
      const { id, slug, ...rest } = input

      const patch: Partial<typeof leadSourcesTable.$inferInsert> = { ...rest }

      if (slug !== undefined) {
        // Reject malformed input — only canonical kebab-case is accepted.
        if (slugify(slug, { maxLen: 64 }) !== slug) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Use lowercase letters, numbers, and hyphens only.',
          })
        }

        // Read current slug so a no-op save (UI echoes the existing slug)
        // does not silently rotate the token and break live intake URLs.
        const [current] = await db
          .select({ slug: leadSourcesTable.slug })
          .from(leadSourcesTable)
          .where(eq(leadSourcesTable.id, id))
          .limit(1)
        if (!current) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
        }

        if (slug !== current.slug) {
          // Reject duplicates against any other source.
          const [existing] = await db
            .select({ id: leadSourcesTable.id })
            .from(leadSourcesTable)
            .where(and(eq(leadSourcesTable.slug, slug), ne(leadSourcesTable.id, id)))
            .limit(1)
          if (existing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'That slug is already in use.',
            })
          }
          patch.slug = slug
          patch.token = generateToken()
        }
      }

      const [updated] = await db
        .update(leadSourcesTable)
        .set(patch)
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

  archive: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.user.role)
      const [updated] = await db
        .update(leadSourcesTable)
        .set({ archivedAt: new Date().toISOString() })
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
      const attachedCount = await db.$count(customers, customersMatchingSource(input.id))
      if (attachedCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `${attachedCount} ${attachedCount === 1 ? 'customer is' : 'customers are'} still attached. Reassign or archive instead.`,
        })
      }
      await db.delete(leadSourcesTable).where(eq(leadSourcesTable.id, input.id))
      return { success: true as const }
    }),
})
