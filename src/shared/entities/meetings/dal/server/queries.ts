import type { MeetingParticipantRole } from '@/shared/constants/enums'
import type { ProposalStatus } from '@/shared/constants/enums/proposals'
import type { PaginatedResult } from '@/shared/dal/server/lib/query/output'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema/meetings'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'

import { and, asc, count, eq, getTableColumns, gt, gte, ilike, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
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
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetings } from '@/shared/db/schema/meetings'
import { canSeeUngatedPhone, gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { profileCols } from '@/shared/entities/customers/lib/profile-select'
import { getAllParticipantsForMeetings } from '@/shared/entities/meetings/dal/server/participants'
import { addCalendarDays, BUSINESS_TIMEZONE, startOfDayInTimeZone } from '@/shared/lib/business-time'
import { toNationalDigits } from '@/shared/lib/phone'

export interface MeetingListParticipant {
  id: string
  name: string
  image: string | null
  role: MeetingParticipantRole
}

export interface MeetingListOwnerSlot {
  id: string
  userId: string
  role: 'owner' | 'co_owner'
  userName: string
  userEmail: string
  userImage: string | null
}

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
  leadSource: { id: string, name: string, slug: string, isActive: boolean } | null
  /** One entry per proposal, oldest first. */
  proposalStatuses: ProposalStatus[]
  participants: MeetingListParticipant[]
  owner: MeetingListOwnerSlot | null
  coOwner: MeetingListOwnerSlot | null
}

export const meetingListFiltersSchema = {
  outcome: z.array(z.enum(meetingOutcomes)).optional(),
  scheduledFor: dateRangeSchema.optional(),
  pipeline: z.enum(pipelines).optional(),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
}

export const meetingListInputSchema = paginatedQueryInput(meetingListFiltersSchema)
export type MeetingListInput = z.infer<typeof meetingListInputSchema>

export type MeetingWithCustomer = Meeting & {
  customer: MeetingCustomer | null
  ownerName: string
  ownerImage: string | null
  ownerHeadshotUrl: string | null
  ownerEmail: string
  ownerPhone: string | null
  ownerYearsOfExperience: number | null
  proposalCount: number
  hasSentProposal: boolean
  hasApprovedProposal: boolean
}

export type MeetingCustomer = CustomerWithProfile

/** Participants are batched in a separate query rather than role-filtered LEFT JOINs, so a duplicate row can never multiply via cross-product. */
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
    })

    const result = await paginate({
      query: () => db
        .select({
          ...getTableColumns(meetings),
          customerName: customers.name,
          customerPhone: gatedPhoneSql(canSeeUngatedPhone(ctx.ability)),
          customerHasSentProposal: hasSentProposalSql(),
          customerAddress: customers.address,
          customerCity: customers.city,
          customerState: customers.state,
          customerZip: customers.zip,
          // Still derived from meetings.ownerId for consumers that read ownerName/ownerImage directly.
          ownerName: user.name,
          ownerImage: user.image,
          proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id})`.as('proposal_count'),
          hasSentProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'sent')`.as('has_sent_proposal'),
          hasApprovedProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'approved')`.as('has_approved_proposal'),
          // Agents can't call leadSourcesRouter (super-admin only), so the row carries the name.
          leadSource: {
            id: leadSourcesTable.id,
            name: leadSourcesTable.name,
            slug: leadSourcesTable.slug,
            isActive: leadSourcesTable.isActive,
          },
          proposalStatuses: sql<ProposalStatus[]>`COALESCE((SELECT json_agg(p.status ORDER BY p.created_at, p.id) FROM proposals p WHERE p.meeting_id = ${meetings.id}), '[]'::json)`.as('proposal_statuses'),
        })
        .from(meetings)
        .leftJoin(customers, eq(customers.id, meetings.customerId))
        .leftJoin(user, eq(user.id, meetings.ownerId))
        .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
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
          leadSource: row.leadSource,
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

/** Phone-gated: agents see the phone only after a proposal is sent. */
export async function getByIdWithJoins(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<MeetingWithCustomer | undefined>> {
  return dalDbOperation(async () => {
    // The raw phone column is swapped out of the projection so destructuring `row.customer` can't leak the ungated value.
    const { phone: _customerPhone, ...customerCols } = getTableColumns(customers)

    const [row] = await db
      .select({
        ...getTableColumns(meetings),
        customer: {
          ...customerCols,
          ...profileCols(),
          phone: gatedPhoneSql(canSeeUngatedPhone(ctx.ability)),
          hasSentProposal: hasSentProposalSql(),
        },
        ownerName: user.name,
        ownerImage: user.image,
        ownerHeadshotUrl: user.headshotUrl,
        ownerEmail: user.email,
        ownerPhone: user.phone,
        ownerYearsOfExperience: user.yearsOfExperience,
        proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id})`.as('proposal_count'),
        hasSentProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'sent')`.as('has_sent_proposal'),
        hasApprovedProposal: sql<boolean>`EXISTS (SELECT 1 FROM proposals p WHERE p.meeting_id = ${meetings.id} AND p.status = 'approved')`.as('has_approved_proposal'),
      })
      .from(meetings)
      .leftJoin(customers, eq(customers.id, meetings.customerId))
      .leftJoin(customerProfiles, eq(customerProfiles.customerId, customers.id))
      // `meetings.owner_id` is NOT NULL with an FK, so every meeting has its owner.
      .innerJoin(user, eq(user.id, meetings.ownerId))
      .where(and(
        eq(meetings.id, input.id),
        ctx.scope ?? undefined,
      ))

    if (!row) {
      return undefined
    }

    // leftJoin miss yields an all-null customer object rather than null.
    const customer = row.customer?.id ? row.customer : null

    return { ...row, customer } as MeetingWithCustomer
  })
}

/** Unscoped — only for entity hooks that already run behind a scope-checked write. */
export async function getMeetingSchedule(id: string): Promise<Pick<Meeting, 'scheduledFor' | 'confirmedAt'> | undefined> {
  const [row] = await db
    .select({ scheduledFor: meetings.scheduledFor, confirmedAt: meetings.confirmedAt })
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1)
  return row
}

export interface ReminderCandidate {
  meetingId: string
  scheduledFor: string
  customerId: string
  customerName: string
  // Bare 10-digit national, as stored. Null rows are excluded in SQL.
  customerPhone: string
  ownerName: string
}

/**
 * Unscoped: only the reminder batch calls this, under SYSTEM_CONTEXT. Selects the
 * meetings on `dayKey` (a YYYY-MM-DD in the business timezone) that are still live,
 * unconfirmed, un-reminded, and have a textable customer. DNC is checked by the
 * compliance service, not here, so there is one DNC gate in the codebase.
 */
function reminderTargetQuery() {
  return db
    .select({
      meetingId: meetings.id,
      scheduledFor: meetings.scheduledFor,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: sql<string>`${customers.phone}`,
      ownerName: user.name,
    })
    .from(meetings)
    .innerJoin(customers, eq(customers.id, meetings.customerId))
    .innerJoin(user, eq(user.id, meetings.ownerId))
}

/** Unscoped, for the booking-confirmation job. Null when the meeting is gone, cancelled, or has no textable customer. */
export async function getReminderTargetByMeetingId(meetingId: string): Promise<DalReturn<ReminderCandidate | null>> {
  return dalDbOperation(async () => {
    const [row] = await reminderTargetQuery()
      .where(and(
        eq(meetings.id, meetingId),
        sql`${meetings.meetingOutcome} <> 'cancelled'`,
        sql`${customers.phone} IS NOT NULL`,
      ))
      .limit(1)
    return row ?? null
  })
}

export async function listReminderCandidates(dayKey: string): Promise<DalReturn<ReminderCandidate[]>> {
  return dalDbOperation(async () => {
    const from = startOfDayInTimeZone(dayKey, BUSINESS_TIMEZONE).toISOString()
    const to = startOfDayInTimeZone(addCalendarDays(dayKey, 1), BUSINESS_TIMEZONE).toISOString()

    return reminderTargetQuery()
      .where(and(
        gte(meetings.scheduledFor, from),
        lt(meetings.scheduledFor, to),
        isNull(meetings.confirmedAt),
        isNull(meetings.reminderSentAt),
        sql`${meetings.meetingOutcome} <> 'cancelled'`,
        sql`${customers.phone} IS NOT NULL`,
      ))
      .orderBy(asc(meetings.scheduledFor))
  })
}

export interface UpcomingMeetingForReply {
  meetingId: string
  scheduledFor: string
  confirmedAt: string | null
  customerId: string
  customerName: string
  ownerName: string
}

/**
 * The soonest future meeting for the customer who owns `phone`. A "C" reply is applied to
 * this row; a customer with two upcoming meetings confirms the nearer one, which is the
 * one the reminder was about.
 */
export async function findNextMeetingByCustomerPhone(phone: string): Promise<DalReturn<UpcomingMeetingForReply | null>> {
  return dalDbOperation(async () => {
    const national = toNationalDigits(phone)
    if (!national) {
      return null
    }
    const [row] = await db
      .select({
        meetingId: meetings.id,
        scheduledFor: meetings.scheduledFor,
        confirmedAt: meetings.confirmedAt,
        customerId: customers.id,
        customerName: customers.name,
        ownerName: user.name,
      })
      .from(meetings)
      .innerJoin(customers, eq(customers.id, meetings.customerId))
      .innerJoin(user, eq(user.id, meetings.ownerId))
      .where(and(
        eq(customers.phone, national),
        gt(meetings.scheduledFor, new Date().toISOString()),
        sql`${meetings.meetingOutcome} <> 'cancelled'`,
      ))
      .orderBy(asc(meetings.scheduledFor))
      .limit(1)
    return row ?? null
  })
}
