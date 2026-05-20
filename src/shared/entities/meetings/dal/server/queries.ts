// Business queries for the meetings entity. Multi-table joins, derived
// columns, participant batching, and entity-specific filters.
// see ../../DOCS.md for business rules.
// All DAL conventions: see docs/codebase-conventions/dal-conventions.md

import type { MeetingParticipantRole } from '@/shared/constants/enums'
import type { PaginatedResult } from '@/shared/dal/server/lib/query/output'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema/meetings'

import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import z from 'zod'

import { meetingOutcomes } from '@/shared/constants/enums'
import { pipelines } from '@/shared/constants/enums/pipelines'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { buildFilterWhere } from '@/shared/dal/server/lib/query/filters'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'
import { buildOrderBy } from '@/shared/dal/server/lib/query/sort'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { getAllParticipantsForMeetings } from '@/shared/entities/meetings/dal/server/participants'

// ── Types ───────────────────────────────────────────────────────────────

/** Participant summary attached to each list row. */
export interface MeetingListParticipant {
  id: string
  name: string
  image: string | null
  role: MeetingParticipantRole
}

/** Owner/co-owner detail attached to each list row. */
export interface MeetingListOwnerSlot {
  id: string
  userId: string
  role: 'owner' | 'co_owner'
  userName: string
  userEmail: string
  userImage: string | null
}

/** Enriched row returned by `listMeetings` — base columns + customer fields + owner fields + proposal subqueries + participants. */
export type MeetingListRow = Meeting & {
  customerName: string | null
  customerPhone: string | null
  customerHasSentProposal: boolean
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  ownerName: string | null
  ownerImage: string | null
  proposalCount: number
  hasSentProposal: boolean
  hasApprovedProposal: boolean
  participants: MeetingListParticipant[]
  owner: MeetingListOwnerSlot | null
  coOwner: MeetingListOwnerSlot | null
}

// Filter schema — exported so the router can reference the same shape in its `.input()`.
export const meetingListFiltersSchema = {
  outcome: z.array(z.enum(meetingOutcomes)).optional(),
  scheduledFor: dateRangeSchema.optional(),
  pipeline: z.enum(pipelines).optional(),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
}

export const meetingListInputSchema = paginatedQueryInput(meetingListFiltersSchema)
export type MeetingListInput = z.infer<typeof meetingListInputSchema>

/** Enriched single-meeting type for getById — meeting + full customer + owner + proposal subqueries. */
export type MeetingWithCustomer = Meeting & {
  customer: MeetingCustomer | null
  ownerName: string | null
  ownerImage: string | null
  proposalCount: number
  hasSentProposal: boolean
  hasApprovedProposal: boolean
}

/** Customer shape embedded in a single-meeting read. */
export interface MeetingCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string
  state: string | null
  zip: string
  notionContactId: string | null
  qbCustomerId: string | null
  latitude: number | null
  longitude: number | null
  geocodedAt: string | null
  customerProfileJSON: any
  propertyProfileJSON: any
  financialProfileJSON: any
  leadSourceId: string | null
  leadType: string | null
  leadMetaJSON: any
  pipeline: string
  pipelineStage: string | null
  syncedAt: string
  createdAt: string
  updatedAt: string
  hasSentProposal: boolean
}

// ── listMeetings ────────────────────────────────────────────────────────

/**
 * Server-paginated meetings list. Drives every meetings consumer (calendar,
 * schedule, past-meetings table, customer profile lists). Scope is set by
 * middleware (omni: no filter; agent: participation predicate).
 *
 * Search: ilike against customers.name OR meetings.meetingType.
 * Sort whitelist: customerName, scheduledFor, meetingOutcome, createdAt.
 * Default order: createdAt DESC.
 *
 * Participants are batched in a separate query (rather than role-filtered
 * LEFT JOINs) so a defensive duplicate row can never multiply via
 * cross-product.
 */
export async function listMeetings(
  ctx: ScopedContext,
  input: MeetingListInput,
): Promise<DalReturn<PaginatedResult<MeetingListRow>>> {
  return dalDbOperation(async () => {
    const searchTerm = input.search?.trim()
    const searchWhere = searchTerm
      ? or(
          ilike(customers.name, `%${searchTerm}%`),
          ilike(sql`${meetings.meetingType}::text`, `%${searchTerm}%`),
        )
      : undefined

    const filterWhere = buildFilterWhere(input.filters, {
      outcome: v => (v.length > 0 ? inArray(meetings.meetingOutcome, v) : undefined),
      scheduledFor: v => and(
        v.from ? gte(meetings.scheduledFor, v.from) : undefined,
        v.to ? lte(meetings.scheduledFor, v.to) : undefined,
      ),
      pipeline: (v) => {
        if (v === 'projects') {
          return sql`${meetings.projectId} IS NOT NULL`
        }
        if (v === 'leads') {
          // No leads pipeline at meeting level; leads are pre-meeting.
          return sql`FALSE`
        }
        return and(
          sql`${meetings.projectId} IS NULL`,
          eq(meetings.pipeline, v),
        )
      },
      customerId: v => eq(meetings.customerId, v),
      projectId: v => eq(meetings.projectId, v),
    })

    const where = and(ctx.scope ?? undefined, searchWhere, filterWhere)

    const orderBy = buildOrderBy(input.sort, {
      customerName: customers.name,
      scheduledFor: meetings.scheduledFor,
      meetingOutcome: meetings.meetingOutcome,
      createdAt: meetings.createdAt,
    }, desc(meetings.createdAt))

    const isOmni = ctx.scope === null

    const result = await paginate({
      query: () => db
        .select({
          ...getTableColumns(meetings),
          customerName: customers.name,
          customerPhone: gatedPhoneSql(isOmni),
          customerHasSentProposal: hasSentProposalSql(),
          customerAddress: customers.address,
          customerCity: customers.city,
          customerState: customers.state,
          customerZip: customers.zip,
          // Legacy fields — still derived from meetings.ownerId for backward
          // compatibility with consumers that read ownerName/ownerImage directly.
          ownerName: user.name,
          ownerImage: user.image,
          proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id})`.as('proposal_count'),
          hasSentProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'sent')`.as('has_sent_proposal'),
          hasApprovedProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'approved')`.as('has_approved_proposal'),
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .leftJoin(user, eq(user.id, meetings.ownerId))
        .where(where)
        .orderBy(...orderBy)
        .limit(input.pagination.limit)
        .offset(input.pagination.offset),
      count: async () => {
        const [row] = await db
          .select({ c: count(meetings.id) })
          .from(meetings)
          .leftJoin(customers, eq(customers.id, meetings.customerId))
          .where(where)
        return row?.c ?? 0
      },
    })

    // Batch-fetch participants — prevents N+1 from per-row LEFT JOINs.
    const meetingIds = result.rows.map(r => r.id)
    const participantRows = meetingIds.length > 0
      ? await getAllParticipantsForMeetings(meetingIds)
      : []

    const participantsByMeeting = new Map<string, typeof participantRows>()
    for (const p of participantRows) {
      const list = participantsByMeeting.get(p.meetingId)
      if (list) {
        list.push(p)
      }
      else {
        participantsByMeeting.set(p.meetingId, [p])
      }
    }

    return {
      rows: result.rows.map((row) => {
        const rowParticipants = participantsByMeeting.get(row.id) ?? []
        const ownerRow = rowParticipants.find(p => p.role === 'owner')
        const coOwnerRow = rowParticipants.find(p => p.role === 'co_owner')

        return {
          ...row,
          participants: rowParticipants.map(p => ({
            id: p.userId,
            name: p.userName,
            image: p.userImage,
            role: p.role,
          })),
          owner: ownerRow
            ? {
                id: ownerRow.participantId,
                userId: ownerRow.userId,
                role: 'owner' as const,
                userName: ownerRow.userName,
                userEmail: ownerRow.userEmail,
                userImage: ownerRow.userImage,
              }
            : null,
          coOwner: coOwnerRow
            ? {
                id: coOwnerRow.participantId,
                userId: coOwnerRow.userId,
                role: 'co_owner' as const,
                userName: coOwnerRow.userName,
                userEmail: coOwnerRow.userEmail,
                userImage: coOwnerRow.userImage,
              }
            : null,
        }
      }),
      total: result.total,
    } as PaginatedResult<MeetingListRow>
  })
}

// ── getByIdWithJoins ────────────────────────────────────────────────────

/**
 * Enriched single-meeting read: meeting + full customer + owner + proposal
 * subqueries. Scope is set by middleware (omni: no visibility filter;
 * agent: participation predicate).
 *
 * Phone gating applies — agents see phone only after a proposal is sent.
 * see src/shared/entities/customers/DOCS.md#phone-visibility-threshold
 */
export async function getByIdWithJoins(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<MeetingWithCustomer | undefined>> {
  return dalDbOperation(async () => {
    const isOmni = ctx.scope === null
    // Swap the raw phone column out of the customer projection so
    // destructuring `row.customer` can't accidentally leak the ungated value.
    const { phone: _customerPhone, ...customerCols } = getTableColumns(customers)

    const [row] = await db
      .select({
        ...getTableColumns(meetings),
        customer: {
          ...customerCols,
          phone: gatedPhoneSql(isOmni),
          hasSentProposal: hasSentProposalSql(),
        },
        ownerName: user.name,
        ownerImage: user.image,
        proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id})`.as('proposal_count'),
        hasSentProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'sent')`.as('has_sent_proposal'),
        hasApprovedProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'approved')`.as('has_approved_proposal'),
      })
      .from(meetings)
      .leftJoin(customers, eq(customers.id, meetings.customerId))
      .leftJoin(user, eq(user.id, meetings.ownerId))
      .where(and(
        eq(meetings.id, input.id),
        ctx.scope ?? undefined,
      ))

    if (!row) {
      return undefined
    }

    // Normalize null customer (leftJoin returns null for all fields when no match)
    const customer = row.customer?.id ? row.customer : null

    return { ...row, customer } as MeetingWithCustomer
  })
}
