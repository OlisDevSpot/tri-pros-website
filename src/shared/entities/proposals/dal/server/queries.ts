// ─── Proposal Business Queries ──────────────────────────────────────────────
// Enriched reads and complex list queries for the proposals entity. These
// handle multi-table joins, derived columns, and entity-specific filters
// that the generic CRUD DAL cannot express.
//
// Every function receives `ScopedContext` and applies `ctx.scope` for
// visibility-scoped WHERE clauses (null = omni, SQL predicate = scoped).
// Returns DalReturn<T> — never throws.

import type { MeetingPipeline } from '@/shared/constants/enums'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/lib/types'
import type { PaginatedResult } from '@/shared/dal/server/query/output'
import type { ProposalView } from '@/shared/db/schema/proposal-views'
import type { Proposal } from '@/shared/db/schema/proposals'
import type { Row } from '@/shared/db/types'

import { and, count, desc, eq, getTableColumns, gte, inArray, lte, max, or, sql } from 'drizzle-orm'
import z from 'zod'

import { proposalKinds, proposalStatuses } from '@/shared/constants/enums'
import { pipelines } from '@/shared/constants/enums/pipelines'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { buildFilterWhere } from '@/shared/dal/server/query/filters'
import { paginate } from '@/shared/dal/server/query/output'
import { dateRangeSchema, numberRangeSchema, paginatedQueryInput } from '@/shared/dal/server/query/schemas'
import { buildOrderBy } from '@/shared/dal/server/query/sort'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'

// ── Types ───────────────────────────────────────────────────────────────

export interface ProposalCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string
  state: string | null
  zip: string
  customerAge: number | null
}

export type ProposalWithCustomer = Proposal & {
  customer: ProposalCustomer | null
  meetingProjectId: string | null
  projectFirstContractSentAt: string | null
}

/**
 * Enriched row returned by `listProposals` — base proposal columns plus
 * view stats and meeting/customer context for table display.
 */
export type ProposalListRow = Proposal & {
  viewCount: number
  lastViewedAt: string | null
  customerId: string | null
  customerName: string | null
  meetingPipeline: MeetingPipeline | null
  meetingProjectId: string | null
}

// ── Filter schema ───────────────────────────────────────────────────────
// Exported so the router can reference the same shape in its `.input()`.

export const proposalListFiltersSchema = {
  status: z.array(z.enum(proposalStatuses)).optional(),
  kind: z.array(z.enum(proposalKinds)).optional(),
  createdAt: dateRangeSchema.optional(),
  sentAt: dateRangeSchema.optional(),
  pipeline: z.enum(pipelines).optional(),
  price: numberRangeSchema.optional(),
  customerId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
}

export const proposalListInputSchema = paginatedQueryInput(proposalListFiltersSchema)
export type ProposalListInput = z.infer<typeof proposalListInputSchema>

// ── getFullView ─────────────────────────────────────────────────────────
//
// Enriched single-proposal read with customer data, meeting project
// linkage, and project-first-contract-sent-at subquery. Used by the
// proposal page, delivery flow, contracts, and any UI that needs the
// full proposal + customer context.
//
// Applies `ctx.scope` for visibility scoping. On the authed path, scope
// is the visibility predicate (e.g. userParticipatesInMeeting). On the
// shareable/token path, scope is `eq(proposals.token, token)`. The
// middleware sets `ctx.scope` appropriately for both paths.

export async function getFullView(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<ProposalWithCustomer | undefined>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({
        ...getTableColumns(proposals),
        customer: {
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          address: customers.address,
          city: customers.city,
          state: customers.state,
          zip: customers.zip,
          customerProfileJSON: customers.customerProfileJSON,
        },
        // The proposal's meeting's projectId. Null = meeting has no
        // project yet (one is created when the meeting's initial-sale
        // proposal is approved). Non-null = meeting is on an existing
        // project. Note: this is the meeting's *current* projectId —
        // distinct from `proposal.kind`, which is the kind frozen at
        // proposal insert. Used by UI surfaces that need project linkage
        // (e.g., the project-creation gate in PastProposalsTable).
        meetingProjectId: meetings.projectId,
        // Best-available "original contract date" for this proposal's
        // project — drives AWD's `original-contract-date` on additional-
        // work envelopes. Falls through `contract_sent_at → approved_at →
        // created_at` because projects can exist before the original
        // proposal's contract is sent (project conversion fires on
        // approval, contract goes out after). Null only when the meeting
        // has no project (initial-sale, where this field is unused).
        projectFirstContractSentAt: sql<string | null>`(
        SELECT COALESCE(MIN(p2.contract_sent_at), MIN(p2.approved_at), MIN(p2.created_at))
        FROM ${proposals} p2
        JOIN ${meetings} m2 ON m2.id = p2.meeting_id
        WHERE m2.project_id = ${meetings.projectId}
      )`,
      })
      .from(proposals)
      .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
      .leftJoin(customers, eq(customers.id, meetings.customerId))
      .where(and(eq(proposals.id, input.id), ctx.scope ?? undefined))

    if (!row) {
      return undefined
    }

    const customer: ProposalCustomer | null = row.customer?.id
      ? {
          id: row.customer.id,
          name: row.customer.name,
          phone: row.customer.phone,
          email: row.customer.email,
          address: row.customer.address,
          city: row.customer.city,
          state: row.customer.state,
          zip: row.customer.zip,
          customerAge: row.customer.customerProfileJSON?.age ?? null,
        }
      : null

    return { ...row, customer } as ProposalWithCustomer
  })
}

// ── listProposals ───────────────────────────────────────────────────────
//
// Server-paginated proposals list. Drives the Past Proposals table and
// the dashboard-widget recent-proposals strip. Applies `ctx.scope` for
// visibility (null for omni callers, SQL predicate for scoped agents).
//
// Filters (URL-driven via the query toolkit):
//   status:     multi-select on proposals.status
//   kind:       multi-select on proposals.kind
//   createdAt:  date-range on proposals.createdAt
//   sentAt:     date-range on proposals.sentAt
//   pipeline:   'projects' | 'fresh' | 'rehash' | 'dead' (derived)
//   price:      number-range on derived finalTcp
//   customerId: scope to one customer (profile modal)
//   meetingId:  scope to one meeting (meeting overview card list)
//
// Search: ilike against proposals.label OR customers.name.
// Sort whitelist: createdAt, sentAt, status, label, customerName, viewCount, price.
// Default order: createdAt DESC.
//
// `price` is derived (matches `computeFinalTcp` in entities/proposals/lib):
//   GREATEST(0, startingTcp - SUM(discount-typed incentive amounts))

export async function listProposals(
  ctx: ScopedContext,
  input: ProposalListInput,
): Promise<DalReturn<PaginatedResult<ProposalListRow>>> {
  return dalDbOperation(async () => {
    const searchTerm = input.search?.trim()
    const searchWhere = searchTerm
      ? or(
          sql`${proposals.label} ILIKE ${`%${searchTerm}%`}`,
          sql`${customers.name} ILIKE ${`%${searchTerm}%`}`,
        )
      : undefined

    // Derived final contract price — mirrors `computeFinalTcp` in
    // shared/entities/proposals/lib. Used by both the price filter and the
    // `price` sort key below.
    const finalTcpExpr = sql<number>`GREATEST(
      0::numeric,
      COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0)
      - COALESCE((
          SELECT SUM((inc->>'amount')::numeric)
          FROM jsonb_array_elements(${proposals.fundingJSON}->'data'->'incentives') AS inc
          WHERE inc->>'type' = 'discount'
        ), 0)
    )`

    const filterWhere = buildFilterWhere(input.filters, {
      status: v => (v.length > 0 ? inArray(proposals.status, v) : undefined),
      kind: v => (v.length > 0 ? inArray(proposals.kind, v) : undefined),
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
      price: v => and(
        typeof v.min === 'number' ? sql`${finalTcpExpr} >= ${v.min}` : undefined,
        typeof v.max === 'number' ? sql`${finalTcpExpr} <= ${v.max}` : undefined,
      ),
      customerId: v => eq(customers.id, v),
      meetingId: v => eq(proposals.meetingId, v),
    })

    const where = and(ctx.scope ?? undefined, searchWhere, filterWhere)

    const orderBy = buildOrderBy(input.sort, {
      createdAt: proposals.createdAt,
      sentAt: proposals.sentAt,
      status: proposals.status,
      label: proposals.label,
      customerName: customers.name,
      price: finalTcpExpr,
    }, desc(proposals.createdAt))

    return await paginate({
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
    }) as unknown as PaginatedResult<ProposalListRow>
  })
}

// ── getProposalViews ─────────────────────────────────────────────────────────

export interface ProposalViewStats {
  totalViews: number
  lastViewedAt: string | null
  emailViews: number
  directViews: number
  views: ProposalView[]
}

/**
 * Returns view stats for a proposal — total count, last viewed, breakdown
 * by source, and the raw view records ordered most-recent-first.
 */
export async function getProposalViews(
  input: { proposalId: string },
): Promise<DalReturn<ProposalViewStats>> {
  return dalDbOperation(async () => {
    const views = await db
      .select()
      .from(proposalViews)
      .where(eq(proposalViews.proposalId, input.proposalId))
      .orderBy(desc(proposalViews.viewedAt))

    return {
      totalViews: views.length,
      lastViewedAt: views[0]?.viewedAt ?? null,
      emailViews: views.filter(v => v.source === 'email').length,
      directViews: views.filter(v => v.source === 'direct').length,
      views,
    }
  })
}

// ── getBySigningRequestId ──────────────────────────────────────────────
//
// Lookup a proposal by its Zoho Sign signing request ID (non-PK field).
// Used by contracts.service.applyContractEvent to find the proposal
// associated with a webhook event, then update it via generic CRUD.
// Returns plain row — no joins needed for contract event processing.

export async function getBySigningRequestId(
  ctx: ScopedContext,
  input: { signingRequestId: string },
): Promise<DalReturn<Row<typeof proposals> | undefined>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(proposals)
      .where(and(
        eq(proposals.signingRequestId, input.signingRequestId),
        ctx.scope ?? undefined,
      ))
      .limit(1)
    return row
  })
}
