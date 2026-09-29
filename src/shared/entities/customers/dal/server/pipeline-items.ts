// LAZY: customers is still a plain entity; this read moves to modules/customers/core/dal/server when customers is promoted to a module.

import type { SQL } from 'drizzle-orm'

import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerPipelineItem, CustomerPipelineRawData, PipelineItemProposal, PipelineItemRep } from '@/shared/entities/customers/types/pipeline-item'

import { and, asc, count, desc, eq, exists, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm'
import z from 'zod'

import { DECIDED_OUTCOMES } from '@/shared/constants/enums/meetings'
import { deriveProjectStatusBucket, pipelines } from '@/shared/constants/enums/pipelines'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { computeFreshStage } from '@/shared/domains/pipelines/lib/compute-fresh-stage'
import { computePipelineValue, computeProjectValue } from '@/shared/domains/pipelines/lib/compute-pipeline-value'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import { CUSTOMER_FIELD_SQL } from '@/shared/entities/customers/dal/server/customer-field-sql'
import { canSeeUngatedPhone, gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

export const customerPipelineItemsInputSchema = fieldListInput(CUSTOMER_FIELDS, { pagination: false }).extend({
  pipeline: z.enum(pipelines),
})
export type CustomerPipelineItemsInput = z.infer<typeof customerPipelineItemsInputSchema>

/** Everything a branch needs: who is asking, and the customer filter, search and order the kanban toolbar chose. */
interface PipelineBranchArgs {
  userId: string
  isOmni: boolean
  canSeeUngated: boolean
  customerWhere: SQL | undefined
  /** Undefined keeps the branch's own natural order. */
  customerOrder: SQL[] | undefined
}

export async function getCustomerPipelineItems(ctx: ScopedContext, input: CustomerPipelineItemsInput): Promise<DalReturn<PaginatedResult<CustomerPipelineItem>>> {
  return dalDbOperation(async () => {
    const args: PipelineBranchArgs = {
      // Each pipeline reaches customers through a different table, so scoping stays per branch; without a session the fallback id '' never matches a participant or owner (leads is unscoped; projects still shows public projects).
      userId: ctx.session?.user.id ?? '',
      isOmni: !ctx.ability || ctx.ability.can('manage', 'all'),
      canSeeUngated: canSeeUngatedPhone(ctx.ability),
      customerWhere: and(
        buildSearchWhere(input.search, [customers.name, customers.email]),
        CUSTOMER_FIELD_SQL.where(input.filters),
      ),
      customerOrder: input.sort ? CUSTOMER_FIELD_SQL.orderBy(input.sort) : undefined,
    }
    const rows = await pipelineItemsFor(input.pipeline, args)
    return { rows, total: rows.length }
  })
}

function pipelineItemsFor(pipeline: Pipeline, args: PipelineBranchArgs): Promise<CustomerPipelineItem[]> {
  if (pipeline === 'leads') {
    return getLeadsPipelineItems(args)
  }
  if (pipeline === 'projects') {
    return getProjectsPipelineItems(args)
  }
  if (pipeline !== 'fresh') {
    return getRehashOrDeadPipelineItems(pipeline, args)
  }
  return getFreshPipelineItems(args)
}

/**
 * Leads pipeline items.
 * Finds customers who have zero meetings — these are leads that haven't
 * been scheduled for an in-home consultation yet.
 * Stage comes from customers.pipelineStage (repurposed for leads).
 */
async function getLeadsPipelineItems(args: PipelineBranchArgs): Promise<CustomerPipelineItem[]> {
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: gatedPhoneSql(args.canSeeUngated),
      hasSentProposal: hasSentProposalSql(),
      email: customers.email,
      address: customers.address,
      city: customers.city,
      state: customers.state,
      zip: customers.zip,
      pipelineStage: customers.pipelineStage,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
    .where(and(
      sql`NOT EXISTS (SELECT 1 FROM meetings m WHERE m.customer_id = ${customers.id})`,
      args.customerWhere,
    ))
    .orderBy(...(args.customerOrder ?? [desc(customers.createdAt), asc(customers.id)]))

  return rows.map((row): CustomerPipelineItem => ({
    id: row.id,
    type: 'customer',
    stage: (row.pipelineStage ?? 'new') as CustomerPipelineItem['stage'],
    name: row.name,
    phone: row.phone,
    hasSentProposal: row.hasSentProposal,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    totalPipelineValue: 0,
    meetingCount: 0,
    proposalCount: 0,
    latestActivityAt: row.createdAt,
    nextMeetingId: null,
    nextMeetingAt: null,
    meetingScheduledFor: null,
    meetingConfirmedAt: null,
    assignedRep: null,
    proposals: [],
    project: null,
  }))
}

/**
 * Rehash / dead pipeline items.
 * Finds distinct customers who have at least one meeting with the given pipeline value
 * and no projectId (non-project meetings only).
 */
async function getRehashOrDeadPipelineItems(pipeline: Pipeline, args: PipelineBranchArgs): Promise<CustomerPipelineItem[]> {
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: gatedPhoneSql(args.canSeeUngated),
      hasSentProposal: hasSentProposalSql(),
      email: customers.email,
      address: customers.address,
      city: customers.city,
      state: customers.state,
      zip: customers.zip,
    })
    .from(customers)
    .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
    // EXISTS rather than join + DISTINCT ON: DISTINCT ON pinned the order to customer id, so no sort could apply.
    .where(and(
      exists(db.select({ id: meetings.id }).from(meetings).where(and(
        eq(meetings.customerId, customers.id),
        eq(meetings.pipeline, pipeline as 'fresh' | 'rehash' | 'dead'),
        isNull(meetings.projectId),
        args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),
      ))),
      args.customerWhere,
    ))
    .orderBy(...(args.customerOrder ?? [desc(customers.updatedAt), asc(customers.id)]))

  const defaultStage = pipeline === 'rehash' ? 'schedule_manager_meeting' : 'mostly_dead'

  return rows.map((row): CustomerPipelineItem => ({
    id: row.id,
    type: 'customer',
    stage: defaultStage as CustomerPipelineItem['stage'],
    name: row.name,
    phone: row.phone,
    hasSentProposal: row.hasSentProposal,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    totalPipelineValue: 0,
    meetingCount: 0,
    proposalCount: 0,
    latestActivityAt: '',
    nextMeetingId: null,
    nextMeetingAt: null,
    meetingScheduledFor: null,
    meetingConfirmedAt: null,
    assignedRep: null,
    proposals: [],
    project: null,
  }))
}

/**
 * Fresh pipeline items — full query with computed stages, proposals, reps.
 * Filters meetings by pipeline = 'fresh' AND projectId IS NULL.
 */
async function getFreshPipelineItems(args: PipelineBranchArgs): Promise<CustomerPipelineItem[]> {
  const rows = await db
    .select({
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: gatedPhoneSql(args.canSeeUngated),
      customerHasSentProposal: hasSentProposalSql(),
      customerEmail: customers.email,
      customerAddress: customers.address,
      customerCity: customers.city,
      customerState: customers.state,
      customerZip: customers.zip,
      meetingCount: count(meetings.id).as('meeting_count'),
      hasScheduledFutureMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} > now())`.as('has_future_scheduled'),
      hasConfirmedFutureMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} > now() AND ${meetings.confirmedAt} IS NOT NULL)`.as('has_confirmed_future'),
      hasActiveMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() AND ${meetings.scheduledFor} > now() - interval '2 hours')`.as('has_active'),
      hasPastMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() - interval '2 hours' OR (${meetings.scheduledFor} IS NULL AND ${meetings.meetingOutcome} IN (${sql.join(DECIDED_OUTCOMES.map(o => sql`${o}`), sql`, `)})))`.as('has_past'),
      hasFollowUpNeeded: sql<boolean>`bool_or(${meetings.meetingOutcome} = ${'follow_up_needed'})`.as('has_follow_up_needed'),
      hasRescheduleNeeded: sql<boolean>`bool_or(${meetings.meetingOutcome} = ${'reschedule_needed'})`.as('has_reschedule_needed'),
      latestMeetingAt: max(meetings.createdAt).as('latest_meeting_at'),
      nextMeetingAt: sql<string | null>`min(CASE WHEN ${meetings.scheduledFor} > now() - interval '2 hours' THEN ${meetings.scheduledFor} END)`.as('next_meeting_at'),
    })
    .from(customers)
    .innerJoin(meetings, and(
      eq(meetings.customerId, customers.id),
      eq(meetings.pipeline, 'fresh'),
      isNull(meetings.projectId),
      args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),
    ))
    .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
    .where(args.customerWhere)
    .groupBy(customers.id, leadSourcesTable.id)
    .orderBy(...(args.customerOrder ?? [desc(customers.updatedAt), asc(customers.id)]))

  if (rows.length === 0) {
    return []
  }

  const customerIds = rows.map(r => r.customerId)

  // Pipeline value is read per-customer below from the stored final_tcp_cents
  // rollup (Wave 2). This aggregate query only counts + summarizes statuses.
  const proposalRows = await db
    .select({
      customerId: customers.id,
      proposalCount: count(proposals.id).as('proposal_count'),
      proposalStatuses: sql<string[] | string>`array_agg(DISTINCT ${proposals.status})`.as('proposal_statuses'),
      hasSentContract: sql<boolean>`bool_or(${proposals.contractSentAt} IS NOT NULL)`.as('has_sent_contract'),
      latestProposalAt: max(proposals.createdAt).as('latest_proposal_at'),
    })
    .from(proposals)
    .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
    .innerJoin(customers, eq(customers.id, meetings.customerId))
    .where(and(
      args.isOmni ? undefined : userParticipatesInMeeting(args.userId, proposals.meetingId),
      inArray(customers.id, customerIds),
    ))
    .groupBy(customers.id)

  const proposalMap = new Map(proposalRows.map(r => [r.customerId, r]))

  // Fetch assigned rep + meeting ID: owner of the most relevant meeting (latest by scheduledFor) per customer
  const repRows = await db
    .selectDistinctOn([meetings.customerId], {
      customerId: meetings.customerId,
      meetingId: meetings.id,
      meetingScheduledFor: meetings.scheduledFor,
      meetingConfirmedAt: meetings.confirmedAt,
      repId: user.id,
      repName: user.name,
      repEmail: user.email,
      repImage: user.image,
    })
    .from(meetings)
    .innerJoin(user, eq(user.id, meetings.ownerId))
    .where(and(
      inArray(meetings.customerId, customerIds),
      args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),
    ))
    .orderBy(meetings.customerId, desc(meetings.scheduledFor))

  const repMap = new Map(
    repRows
      .filter(r => r.customerId !== null)
      .map(r => [r.customerId!, {
        meetingId: r.meetingId,
        meetingScheduledFor: r.meetingScheduledFor,
        meetingConfirmedAt: r.meetingConfirmedAt,
        rep: { id: r.repId, name: r.repName, email: r.repEmail, image: r.repImage } as PipelineItemRep,
      }]),
  )

  // Fetch individual proposals per customer for card display + value calculation.
  // Value reads the stored final_tcp_cents rollup (Wave 2).
  const proposalDetailRows = await db
    .select({
      customerId: meetings.customerId,
      meetingId: proposals.meetingId,
      proposalId: proposals.id,
      token: proposals.token,
      status: proposals.status,
      createdAt: proposals.createdAt,
      finalTcpCents: proposals.finalTcpCents,
    })
    .from(proposals)
    .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
    .where(and(
      args.isOmni ? undefined : userParticipatesInMeeting(args.userId, proposals.meetingId),
      inArray(meetings.customerId, customerIds),
    ))
    .orderBy(desc(proposals.createdAt))

  const proposalDetailMap = new Map<string, PipelineItemProposal[]>()
  const proposalValueMap = new Map<string, Array<{ meetingId: string | null, status: string, value: number | null }>>()
  for (const r of proposalDetailRows) {
    if (!r.customerId) {
      continue
    }
    // Stored rollup (Wave 2) — maintained by recomputeProposalFinancials; null
    // only pre-backfill.
    const value = (r.finalTcpCents ?? 0) / 100
    const arr = proposalDetailMap.get(r.customerId) ?? []
    arr.push({ id: r.proposalId, token: r.token, value, status: r.status, createdAt: r.createdAt })
    proposalDetailMap.set(r.customerId, arr)

    const valArr = proposalValueMap.get(r.customerId) ?? []
    valArr.push({ meetingId: r.meetingId, status: r.status, value })
    proposalValueMap.set(r.customerId, valArr)
  }

  return rows.map((row): CustomerPipelineItem => {
    const pData = proposalMap.get(row.customerId)
    const rawStatuses = pData?.proposalStatuses
    const proposalStatuses = Array.isArray(rawStatuses)
      ? rawStatuses.filter(Boolean)
      : typeof rawStatuses === 'string'
        ? rawStatuses.replace(/[{}]/g, '').split(',').filter(Boolean)
        : []

    const rawData: CustomerPipelineRawData = {
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerHasSentProposal: row.customerHasSentProposal,
      customerEmail: row.customerEmail,
      customerAddress: row.customerAddress,
      customerCity: row.customerCity,
      meetingCount: row.meetingCount,
      proposalCount: pData?.proposalCount ?? 0,
      hasPastMeeting: row.hasPastMeeting ?? false,
      hasActiveMeeting: row.hasActiveMeeting ?? false,
      hasScheduledFutureMeeting: row.hasScheduledFutureMeeting ?? false,
      hasConfirmedFutureMeeting: row.hasConfirmedFutureMeeting ?? false,
      hasFollowUpNeeded: row.hasFollowUpNeeded ?? false,
      hasRescheduleNeeded: row.hasRescheduleNeeded ?? false,
      proposalStatuses,
      hasSentContract: pData?.hasSentContract ?? false,
      latestActivityAt: pData?.latestProposalAt ?? row.latestMeetingAt ?? null,
    }

    const stage = computeFreshStage({
      hasPastMeeting: rawData.hasPastMeeting,
      hasActiveMeeting: rawData.hasActiveMeeting,
      hasScheduledFutureMeeting: rawData.hasScheduledFutureMeeting,
      hasConfirmedFutureMeeting: rawData.hasConfirmedFutureMeeting,
      hasFollowUpNeeded: rawData.hasFollowUpNeeded,
      hasRescheduleNeeded: rawData.hasRescheduleNeeded,
      proposalStatuses: rawData.proposalStatuses,
      hasSentContract: rawData.hasSentContract,
    })

    return {
      id: rawData.customerId,
      type: 'customer',
      stage,
      name: rawData.customerName,
      phone: rawData.customerPhone,
      hasSentProposal: rawData.customerHasSentProposal,
      email: rawData.customerEmail,
      address: rawData.customerAddress,
      city: rawData.customerCity,
      state: row.customerState,
      zip: row.customerZip,
      totalPipelineValue: computePipelineValue(proposalValueMap.get(row.customerId) ?? []),
      meetingCount: rawData.meetingCount,
      proposalCount: rawData.proposalCount,
      latestActivityAt: rawData.latestActivityAt,
      nextMeetingId: repMap.get(row.customerId)?.meetingId ?? null,
      nextMeetingAt: row.nextMeetingAt ?? null,
      meetingScheduledFor: repMap.get(row.customerId)?.meetingScheduledFor ?? null,
      meetingConfirmedAt: repMap.get(row.customerId)?.meetingConfirmedAt ?? null,
      assignedRep: repMap.get(row.customerId)?.rep ?? null,
      proposals: proposalDetailMap.get(row.customerId) ?? [],
      project: null,
    }
  })
}

/**
 * Projects pipeline items.
 * Finds customers who have at least one project. Each customer appears once,
 * with their most recently created project's data attached.
 * Stage comes from projects.pipelineStage.
 */
async function getProjectsPipelineItems(args: PipelineBranchArgs): Promise<CustomerPipelineItem[]> {
  // Get projects with customer data
  const projectRows = await db
    .select({
      projectId: projects.id,
      projectTitle: projects.title,
      projectAddress: projects.address,
      projectPipelineStage: projects.pipelineStage,
      projectStartedAt: projects.startedAt,
      projectCreatedAt: projects.createdAt,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: gatedPhoneSql(args.canSeeUngated),
      customerHasSentProposal: hasSentProposalSql(),
      customerEmail: customers.email,
      customerAddress: customers.address,
      customerCity: customers.city,
      customerState: customers.state,
      customerZip: customers.zip,
    })
    .from(projects)
    .innerJoin(customers, eq(customers.id, projects.customerId))
    .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
    .where(and(
      isNotNull(projects.customerId),
      args.isOmni
        ? undefined
        : sql`(${projects.ownerId} = ${args.userId} OR ${projects.isPublic} = true OR EXISTS (SELECT 1 FROM meetings m INNER JOIN meeting_participants mp ON mp.meeting_id = m.id WHERE m.project_id = ${projects.id} AND mp.user_id = ${args.userId}))`,
      args.customerWhere,
    ))
    // Customers take their first row's position below, so the chosen customer order leads and each customer's newest project still wins.
    .orderBy(...(args.customerOrder ?? []), desc(projects.createdAt), asc(customers.id))

  if (projectRows.length === 0) {
    return []
  }

  // Group by customer — take the most recent project per customer
  const customerProjectMap = new Map<string, typeof projectRows[number]>()
  for (const row of projectRows) {
    if (!customerProjectMap.has(row.customerId)) {
      customerProjectMap.set(row.customerId, row)
    }
  }

  const customerIds = Array.from(customerProjectMap.keys())

  // Fetch meetings per project with owner info
  const meetingRows = await db
    .select({
      customerId: meetings.customerId,
      meetingId: meetings.id,
      projectId: meetings.projectId,
      ownerId: user.id,
      ownerName: user.name,
      ownerImage: user.image,
    })
    .from(meetings)
    .innerJoin(user, eq(user.id, meetings.ownerId))
    .where(and(
      inArray(meetings.customerId, customerIds),
      isNotNull(meetings.projectId),
      args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),
    ))
    .orderBy(desc(meetings.createdAt))

  // Fetch proposals per meeting
  const meetingIds = meetingRows.map(m => m.meetingId)
  // Value reads the stored final_tcp_cents rollup (Wave 2).
  const proposalRows = meetingIds.length > 0
    ? await db
        .select({
          meetingId: proposals.meetingId,
          proposalId: proposals.id,
          token: proposals.token,
          status: proposals.status,
          createdAt: proposals.createdAt,
          approvedAt: proposals.approvedAt,
          finalTcpCents: proposals.finalTcpCents,
        })
        .from(proposals)
        .where(inArray(proposals.meetingId, meetingIds))
        .orderBy(desc(proposals.createdAt))
    : []

  // Group proposals by meetingId
  const proposalsByMeeting = new Map<string, PipelineItemProposal[]>()
  const earliestApprovedByCustomer = new Map<string, string>()
  for (const p of proposalRows) {
    if (!p.meetingId) {
      continue
    }
    // Stored rollup (Wave 2) — maintained by recomputeProposalFinancials; null
    // only pre-backfill.
    const value = (p.finalTcpCents ?? 0) / 100
    const arr = proposalsByMeeting.get(p.meetingId) ?? []
    arr.push({ id: p.proposalId, token: p.token, value, status: p.status, createdAt: p.createdAt })
    proposalsByMeeting.set(p.meetingId, arr)

    // Track earliest approvedAt for project startedAt fallback
    if (p.approvedAt && p.status === 'approved') {
      const meeting = meetingRows.find(m => m.meetingId === p.meetingId)
      if (meeting?.customerId) {
        const existing = earliestApprovedByCustomer.get(meeting.customerId)
        if (!existing || p.approvedAt < existing) {
          earliestApprovedByCustomer.set(meeting.customerId, p.approvedAt)
        }
      }
    }
  }

  // Group meetings by customerId with their proposals
  interface ProjectMeeting { id: string, ownerId: string, ownerName: string, ownerImage: string | null, proposals: PipelineItemProposal[] }
  const meetingsByCustomer = new Map<string, ProjectMeeting[]>()
  for (const m of meetingRows) {
    if (!m.customerId) {
      continue
    }
    const arr = meetingsByCustomer.get(m.customerId) ?? []
    arr.push({
      id: m.meetingId,
      ownerId: m.ownerId,
      ownerName: m.ownerName,
      ownerImage: m.ownerImage,
      proposals: proposalsByMeeting.get(m.meetingId) ?? [],
    })
    meetingsByCustomer.set(m.customerId, arr)
  }

  return Array.from(customerProjectMap.entries()).map(([customerId, row]): CustomerPipelineItem => {
    const projectMeetings = meetingsByCustomer.get(customerId) ?? []
    const allProposals = projectMeetings.flatMap(m => m.proposals)
    // Projects pipeline: sum only approved proposals. A project already
    // represents committed work — sent/draft upsells under the same project
    // shouldn't inflate its total (computePipelineValue would average them).
    const totalValue = computeProjectValue(
      projectMeetings.flatMap(m => m.proposals.map(p => ({ meetingId: m.id, status: p.status, value: p.value }))),
    )
    const firstRep = projectMeetings[0]

    return {
      id: customerId,
      type: 'customer',
      stage: (row.projectPipelineStage ?? 'signed') as CustomerPipelineItem['stage'],
      name: row.customerName,
      phone: row.customerPhone,
      hasSentProposal: row.customerHasSentProposal,
      email: row.customerEmail,
      address: row.customerAddress,
      city: row.customerCity,
      state: row.customerState,
      zip: row.customerZip,
      totalPipelineValue: totalValue,
      meetingCount: projectMeetings.length,
      proposalCount: allProposals.length,
      latestActivityAt: row.projectCreatedAt,
      nextMeetingId: firstRep?.id ?? null,
      nextMeetingAt: null,
      meetingScheduledFor: null,
      meetingConfirmedAt: null,
      assignedRep: firstRep ? { id: firstRep.ownerId, name: firstRep.ownerName, email: '', image: firstRep.ownerImage } : null,
      proposals: allProposals,
      project: {
        id: row.projectId,
        title: row.projectTitle,
        address: row.projectAddress,
        status: deriveProjectStatusBucket(row.projectPipelineStage),
        pipelineStage: row.projectPipelineStage,
        startedAt: row.projectStartedAt ?? earliestApprovedByCustomer.get(customerId) ?? null,
        totalValue,
        meetings: projectMeetings,
      },
    }
  })
}
