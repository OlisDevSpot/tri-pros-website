// Business queries for the proposals entity. Multi-table joins, derived
// columns, and entity-specific filters. see ../../DOCS.md for business rules.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { MeetingPipeline } from '@/shared/constants/enums'
import type { PaginatedResult } from '@/shared/dal/server/lib/query/output'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProposalView } from '@/shared/db/schema/proposal-views'
import type { Proposal } from '@/shared/db/schema/proposals'
import type { Row } from '@/shared/db/types'

import { and, count, desc, eq, getTableColumns, gte, inArray, lte, max, or, sql } from 'drizzle-orm'
import z from 'zod'

import { proposalKinds, proposalStatuses } from '@/shared/constants/enums'
import { pipelines } from '@/shared/constants/enums/pipelines'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { buildFilterWhere } from '@/shared/dal/server/lib/query/filters'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { dateRangeSchema, numberRangeSchema, paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'
import { buildOrderBy } from '@/shared/dal/server/lib/query/sort'
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

/** Enriched row returned by `listProposals` — base columns + view stats + meeting/customer context. */
export type ProposalListRow = Proposal & {
  viewCount: number
  lastViewedAt: string | null
  customerId: string | null
  customerName: string | null
  meetingPipeline: MeetingPipeline | null
  meetingProjectId: string | null
}

// Filter schema — exported so the router can reference the same shape in its `.input()`.
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

/**
 * Enriched single-proposal read: proposal + customer + meeting.projectId +
 * earliest contract-sent date across the project. Used by proposal page,
 * delivery, contracts. Scope is set by middleware (authed: visibility predicate;
 * shareable: eq(token)). see ../../DOCS.md#shareable-via-token
 */
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
        // Meeting's *current* projectId — distinct from frozen proposal.kind.
        meetingProjectId: meetings.projectId,
        // Original contract date for AWD envelopes. COALESCE chain order matters:
        // project exists before original contract is sent (conversion on approval,
        // contract after), so contract_sent_at may be null while approved_at exists.
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

/**
 * Server-paginated proposals list. Drives Past Proposals table + dashboard
 * recent-proposals strip. Search: ilike on proposals.label OR customers.name.
 * Sort whitelist below. Default: createdAt DESC.
 * `price` is derived — SQL expression mirrors `computeFinalTcp`. see ../../DOCS.md#final-tcp-derived
 */
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

    // SQL mirror of `computeFinalTcp`. see ../../DOCS.md#final-tcp-derived
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

/** View stats for a proposal: total, last-viewed, source breakdown, raw records (newest first). */
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

/**
 * Lookup by Zoho `signingRequestId` (non-PK). Used by contracts service
 * webhook handler to find the proposal for an inbound event.
 */
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
