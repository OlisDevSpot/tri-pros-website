import type z from 'zod'
import type { MeetingParticipantRole } from '@/shared/constants/enums'
import type { ProposalStatus } from '@/shared/constants/enums/proposals'
import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema/meetings'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import { and, count, eq, exists, getTableColumns, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { projectToReadFields } from '@/shared/dal/server/lib/permissions/project'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { canSeeUngatedPhone, gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { profileCols } from '@/shared/entities/customers/lib/profile-select'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import { MEETING_FIELD_SQL, setterUser } from '@/shared/entities/meetings/dal/server/meeting-field-sql'
import { getMeetingsWithProposals } from '@/shared/entities/meetings/dal/server/meetings-with-proposals'
import { getAllParticipantsForMeetings } from '@/shared/entities/meetings/dal/server/participants'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

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
  setterName: string | null
  setterImage: string | null
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

export const meetingListInputSchema = fieldListInput(MEETING_FIELDS, { pagination: true })
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
    const where = and(
      permit(ctx, 'read', meetingServerSpec).sql,
      buildSearchWhere(input.search, [customers.name, sql`${meetings.meetingType}::text`]),
      MEETING_FIELD_SQL.where(input.filters),
    )
    const orderBy = MEETING_FIELD_SQL.orderBy(input.sort)

    const result = await paginate({
      query: () => db
        .select({
          ...getTableColumns(meetings),
          customerName: customers.name,
          customerPhone: gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability)),
          customerHasSentProposal: hasSentProposalSql(),
          customerAddress: customers.address,
          customerCity: customers.city,
          customerState: customers.state,
          customerZip: customers.zip,
          // Still derived from meetings.ownerId for consumers that read ownerName/ownerImage directly.
          ownerName: user.name,
          ownerImage: user.image,
          setterName: setterUser.name,
          setterImage: setterUser.image,
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
        .leftJoin(setterUser, eq(setterUser.id, meetings.setBy))
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

        // A read field rule (a dispatcher's withheld deal structure) applies to a hand-written row too.
        return projectToReadFields(ctx.actor.ability, meetingServerSpec, {
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
        }, row)
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
          phone: gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability)),
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
        permit(ctx, 'read', meetingServerSpec).sql,
      ))

    if (!row) {
      return undefined
    }

    // leftJoin miss yields an all-null customer object rather than null.
    const customer = row.customer?.id ? row.customer : null

    return projectToReadFields(ctx.actor.ability, meetingServerSpec, { ...row, customer }, row) as MeetingWithCustomer
  })
}

/** Unscoped — only for entity hooks that already run behind a scope-checked write. */
export async function getMeetingSchedule(id: string): Promise<Pick<Meeting, 'scheduledFor' | 'confirmedAt' | 'homeownerConfirmedAt'> | undefined> {
  const [row] = await db
    .select({
      scheduledFor: meetings.scheduledFor,
      confirmedAt: meetings.confirmedAt,
      homeownerConfirmedAt: meetings.homeownerConfirmedAt,
    })
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1)
  return row
}

/**
 * A project's sales history. `ctx.scope` here is the project's visibility (the router runs this under
 * `projectProcedure`), so it is applied through the project: whoever can see the project sees all of its meetings.
 */
export async function listMeetingsForProject(
  ctx: ScopedContext,
  input: { projectId: string },
): Promise<DalReturn<CustomerProfileMeeting[]>> {
  return dalDbOperation(async () => {
    const projectCondition = eq(meetings.projectId, input.projectId)
    const where = ctx.scope
      ? and(projectCondition, exists(db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), ctx.scope)))) ?? projectCondition
      : projectCondition
    const { meetings: rows } = await getMeetingsWithProposals(ctx, where)
    return rows
  })
}

/**
 * A meeting and the meetings it replaced, oldest first. The Meeting read reach gates the meeting asked for;
 * the ones it replaced come with it, because they are the same visit.
 */
export async function getRescheduleChain(
  ctx: ScopedContext,
  input: { meetingId: string },
): Promise<DalReturn<string[]>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT ${meetings.id} AS id, ${meetings.rescheduledFromId} AS rescheduled_from_id, 0 AS depth
        FROM ${meetings}
        WHERE ${and(eq(meetings.id, input.meetingId), permit(ctx, 'read', meetingServerSpec).sql)}
        UNION ALL
        SELECT prior.id, prior.rescheduled_from_id, chain.depth + 1
        FROM meetings prior
        JOIN chain ON prior.id = chain.rescheduled_from_id
        WHERE chain.depth < 50
      )
      SELECT id FROM chain ORDER BY depth DESC
    `)).rows as { id: string }[]
    return rows.map(row => row.id)
  })
}

export async function getRescheduleSuccessorId(meetingId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(eq(meetings.rescheduledFromId, meetingId))
    .limit(1)
  return row?.id ?? null
}
