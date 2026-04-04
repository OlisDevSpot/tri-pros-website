import type { CustomerPipelineItem, CustomerPipelineRawData, PipelineItemProposal, PipelineItemRep } from '@/features/customer-pipelines/types'

import type { Pipeline } from '@/shared/types/enums/pipelines'

import { and, count, desc, eq, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm'

import { computeCustomerStage } from '@/features/customer-pipelines/lib/compute-customer-stage'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'

export async function getCustomerPipelineItems(userId: string, pipeline: Pipeline = 'fresh', isOmni = false): Promise<CustomerPipelineItem[]> {
  if (pipeline === 'leads') {
    return getLeadsPipelineItems()
  }

  if (pipeline === 'projects') {
    return getProjectsPipelineItems(userId, isOmni)
  }

  // Rehash / dead pipelines: find customers with meetings in this pipeline (non-project meetings)
  if (pipeline !== 'fresh') {
    return getRehashOrDeadPipelineItems(userId, pipeline, isOmni)
  }

  // Fresh pipeline: full query with computed stages
  return getFreshPipelineItems(userId, isOmni)
}

/**
 * Leads pipeline items.
 * Finds customers who have zero meetings — these are leads that haven't
 * been scheduled for an in-home consultation yet.
 * Stage comes from customers.pipelineStage (repurposed for leads).
 */
async function getLeadsPipelineItems(): Promise<CustomerPipelineItem[]> {
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      city: customers.city,
      state: customers.state,
      zip: customers.zip,
      pipelineStage: customers.pipelineStage,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(
      sql`NOT EXISTS (SELECT 1 FROM meetings m WHERE m.customer_id = ${customers.id})`,
    )
    .orderBy(desc(customers.createdAt))

  return rows.map((row): CustomerPipelineItem => ({
    id: row.id,
    type: 'customer',
    stage: (row.pipelineStage ?? 'new') as CustomerPipelineItem['stage'],
    name: row.name,
    phone: row.phone,
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
async function getRehashOrDeadPipelineItems(userId: string, pipeline: Pipeline, isOmni: boolean): Promise<CustomerPipelineItem[]> {
  const rows = await db
    .selectDistinctOn([customers.id], {
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      city: customers.city,
      state: customers.state,
      zip: customers.zip,
    })
    .from(customers)
    .innerJoin(meetings, and(
      eq(meetings.customerId, customers.id),
      eq(meetings.pipeline, pipeline as 'fresh' | 'rehash' | 'dead'),
      isNull(meetings.projectId),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .orderBy(customers.id, desc(customers.updatedAt))

  const defaultStage = pipeline === 'rehash' ? 'schedule_manager_meeting' : 'mostly_dead'

  return rows.map((row): CustomerPipelineItem => ({
    id: row.id,
    type: 'customer',
    stage: defaultStage as CustomerPipelineItem['stage'],
    name: row.name,
    phone: row.phone,
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
    assignedRep: null,
    proposals: [],
    project: null,
  }))
}

/**
 * Fresh pipeline items — full query with computed stages, proposals, reps.
 * Filters meetings by pipeline = 'fresh' AND projectId IS NULL.
 */
async function getFreshPipelineItems(userId: string, isOmni: boolean): Promise<CustomerPipelineItem[]> {
  const rows = await db
    .select({
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      customerAddress: customers.address,
      customerCity: customers.city,
      customerState: customers.state,
      customerZip: customers.zip,
      meetingCount: count(meetings.id).as('meeting_count'),
      hasScheduledFutureMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} > now())`.as('has_future_scheduled'),
      hasActiveMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() AND ${meetings.scheduledFor} > now() - interval '2 hours')`.as('has_active'),
      hasPastMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() - interval '2 hours' OR (${meetings.scheduledFor} IS NULL AND ${meetings.meetingOutcome} IN ('proposal_created', 'converted_to_project', 'follow_up_needed', 'not_good', 'pns', 'npns', 'ftd', 'no_show', 'lost_to_competitor', 'not_interested')))`.as('has_past'),
      latestMeetingAt: max(meetings.createdAt).as('latest_meeting_at'),
      nextMeetingAt: sql<string | null>`min(CASE WHEN ${meetings.scheduledFor} > now() - interval '2 hours' THEN ${meetings.scheduledFor} END)`.as('next_meeting_at'),
    })
    .from(customers)
    .innerJoin(meetings, and(
      eq(meetings.customerId, customers.id),
      eq(meetings.pipeline, 'fresh'),
      isNull(meetings.projectId),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .groupBy(customers.id)
    .orderBy(desc(customers.updatedAt))

  if (rows.length === 0) {
    return []
  }

  const customerIds = rows.map(r => r.customerId)

  const proposalRows = await db
    .select({
      customerId: customers.id,
      proposalCount: count(proposals.id).as('proposal_count'),
      totalPipelineValue: sql<number>`COALESCE(SUM(NULLIF(${proposals.fundingJSON}->'data'->>'finalTcp', '')::numeric), 0)`.as('total_value'),
      proposalStatuses: sql<string[] | string>`array_agg(DISTINCT ${proposals.status})`.as('proposal_statuses'),
      hasSentContract: sql<boolean>`bool_or(${proposals.contractSentAt} IS NOT NULL)`.as('has_sent_contract'),
      latestProposalAt: max(proposals.createdAt).as('latest_proposal_at'),
    })
    .from(proposals)
    .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
    .innerJoin(customers, eq(customers.id, meetings.customerId))
    .where(and(
      isOmni ? undefined : eq(proposals.ownerId, userId),
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
      repId: user.id,
      repName: user.name,
      repEmail: user.email,
      repImage: user.image,
    })
    .from(meetings)
    .innerJoin(user, eq(user.id, meetings.ownerId))
    .where(and(
      inArray(meetings.customerId, customerIds),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .orderBy(meetings.customerId, desc(meetings.scheduledFor))

  const repMap = new Map(
    repRows
      .filter(r => r.customerId !== null)
      .map(r => [r.customerId!, {
        meetingId: r.meetingId,
        meetingScheduledFor: r.meetingScheduledFor,
        rep: { id: r.repId, name: r.repName, email: r.repEmail, image: r.repImage } as PipelineItemRep,
      }]),
  )

  // Fetch individual proposals per customer for card display
  const proposalDetailRows = await db
    .select({
      customerId: meetings.customerId,
      proposalId: proposals.id,
      token: proposals.token,
      status: proposals.status,
      createdAt: proposals.createdAt,
      value: sql<number | null>`NULLIF(${proposals.fundingJSON}->'data'->>'finalTcp', '')::numeric`.as('proposal_value'),
    })
    .from(proposals)
    .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
    .where(and(
      isOmni ? undefined : eq(proposals.ownerId, userId),
      inArray(meetings.customerId, customerIds),
    ))
    .orderBy(desc(proposals.createdAt))

  const proposalDetailMap = new Map<string, PipelineItemProposal[]>()
  for (const r of proposalDetailRows) {
    if (!r.customerId) {
      continue
    }
    const arr = proposalDetailMap.get(r.customerId) ?? []
    arr.push({ id: r.proposalId, token: r.token, value: r.value ? Number(r.value) : null, status: r.status, createdAt: r.createdAt })
    proposalDetailMap.set(r.customerId, arr)
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
      customerEmail: row.customerEmail,
      customerAddress: row.customerAddress,
      customerCity: row.customerCity,
      meetingCount: row.meetingCount,
      proposalCount: pData?.proposalCount ?? 0,
      hasPastMeeting: row.hasPastMeeting ?? false,
      hasActiveMeeting: row.hasActiveMeeting ?? false,
      hasScheduledFutureMeeting: row.hasScheduledFutureMeeting ?? false,
      proposalStatuses,
      hasSentContract: pData?.hasSentContract ?? false,
      totalPipelineValue: pData?.totalPipelineValue ? Number(pData.totalPipelineValue) : 0,
      latestActivityAt: pData?.latestProposalAt ?? row.latestMeetingAt ?? null,
    }

    const stage = computeCustomerStage({
      hasPastMeeting: rawData.hasPastMeeting,
      hasActiveMeeting: rawData.hasActiveMeeting,
      hasScheduledFutureMeeting: rawData.hasScheduledFutureMeeting,
      proposalStatuses: rawData.proposalStatuses,
      hasSentContract: rawData.hasSentContract,
    })

    return {
      id: rawData.customerId,
      type: 'customer',
      stage,
      name: rawData.customerName,
      phone: rawData.customerPhone,
      email: rawData.customerEmail,
      address: rawData.customerAddress,
      city: rawData.customerCity,
      state: row.customerState,
      zip: row.customerZip,
      totalPipelineValue: rawData.totalPipelineValue,
      meetingCount: rawData.meetingCount,
      proposalCount: rawData.proposalCount,
      latestActivityAt: rawData.latestActivityAt,
      nextMeetingId: repMap.get(row.customerId)?.meetingId ?? null,
      nextMeetingAt: row.nextMeetingAt ?? null,
      meetingScheduledFor: repMap.get(row.customerId)?.meetingScheduledFor ?? null,
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
async function getProjectsPipelineItems(userId: string, isOmni: boolean): Promise<CustomerPipelineItem[]> {
  // Get projects with customer data
  const projectRows = await db
    .select({
      projectId: projects.id,
      projectTitle: projects.title,
      projectAddress: projects.address,
      projectStatus: projects.status,
      projectPipelineStage: projects.pipelineStage,
      projectCreatedAt: projects.createdAt,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      customerAddress: customers.address,
      customerCity: customers.city,
      customerState: customers.state,
      customerZip: customers.zip,
    })
    .from(projects)
    .innerJoin(customers, eq(customers.id, projects.customerId))
    .where(and(
      isNotNull(projects.customerId),
      isOmni ? undefined : eq(projects.ownerId, userId),
    ))
    .orderBy(desc(projects.createdAt))

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

  // Fetch meeting counts and proposal data for project-linked meetings
  const meetingStats = await db
    .select({
      customerId: meetings.customerId,
      meetingCount: count(meetings.id).as('meeting_count'),
      latestMeetingAt: max(meetings.createdAt).as('latest_meeting_at'),
    })
    .from(meetings)
    .where(and(
      inArray(meetings.customerId, customerIds),
      isNotNull(meetings.projectId),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .groupBy(meetings.customerId)

  const meetingStatsMap = new Map(meetingStats.map(r => [r.customerId!, r]))

  // Fetch proposal data for project-linked meetings (only approved proposals count toward value)
  const proposalStats = await db
    .select({
      customerId: meetings.customerId,
      proposalCount: count(proposals.id).as('proposal_count'),
      totalValue: sql<number>`COALESCE(SUM(CASE WHEN ${proposals.status} = 'approved' THEN NULLIF(${proposals.fundingJSON}->'data'->>'finalTcp', '')::numeric ELSE 0 END), 0)`.as('total_value'),
    })
    .from(proposals)
    .innerJoin(meetings, and(
      eq(meetings.id, proposals.meetingId),
      isNotNull(meetings.projectId),
    ))
    .where(and(
      inArray(meetings.customerId, customerIds),
      isOmni ? undefined : eq(proposals.ownerId, userId),
    ))
    .groupBy(meetings.customerId)

  const proposalStatsMap = new Map(proposalStats.map(r => [r.customerId!, r]))

  // Fetch assigned rep per customer (from project-linked meetings)
  const repRows = await db
    .selectDistinctOn([meetings.customerId], {
      customerId: meetings.customerId,
      meetingId: meetings.id,
      meetingScheduledFor: meetings.scheduledFor,
      repId: user.id,
      repName: user.name,
      repEmail: user.email,
      repImage: user.image,
    })
    .from(meetings)
    .innerJoin(user, eq(user.id, meetings.ownerId))
    .where(and(
      inArray(meetings.customerId, customerIds),
      isNotNull(meetings.projectId),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .orderBy(meetings.customerId, desc(meetings.scheduledFor))

  const repMap = new Map(
    repRows
      .filter(r => r.customerId !== null)
      .map(r => [r.customerId!, {
        meetingId: r.meetingId,
        meetingScheduledFor: r.meetingScheduledFor,
        rep: { id: r.repId, name: r.repName, email: r.repEmail, image: r.repImage } as PipelineItemRep,
      }]),
  )

  // Fetch proposal details for cards
  const proposalDetailRows = await db
    .select({
      customerId: meetings.customerId,
      proposalId: proposals.id,
      token: proposals.token,
      status: proposals.status,
      createdAt: proposals.createdAt,
      value: sql<number | null>`NULLIF(${proposals.fundingJSON}->'data'->>'finalTcp', '')::numeric`.as('proposal_value'),
    })
    .from(proposals)
    .innerJoin(meetings, and(
      eq(meetings.id, proposals.meetingId),
      isNotNull(meetings.projectId),
    ))
    .where(and(
      inArray(meetings.customerId, customerIds),
      isOmni ? undefined : eq(proposals.ownerId, userId),
    ))
    .orderBy(desc(proposals.createdAt))

  const proposalDetailMap = new Map<string, PipelineItemProposal[]>()
  for (const r of proposalDetailRows) {
    if (!r.customerId) {
      continue
    }
    const arr = proposalDetailMap.get(r.customerId) ?? []
    arr.push({ id: r.proposalId, token: r.token, value: r.value ? Number(r.value) : null, status: r.status, createdAt: r.createdAt })
    proposalDetailMap.set(r.customerId, arr)
  }

  return Array.from(customerProjectMap.entries()).map(([customerId, row]): CustomerPipelineItem => {
    const mStats = meetingStatsMap.get(customerId)
    const pStats = proposalStatsMap.get(customerId)

    return {
      id: customerId,
      type: 'customer',
      stage: (row.projectPipelineStage ?? 'signed') as CustomerPipelineItem['stage'],
      name: row.customerName,
      phone: row.customerPhone,
      email: row.customerEmail,
      address: row.customerAddress,
      city: row.customerCity,
      state: row.customerState,
      zip: row.customerZip,
      totalPipelineValue: pStats?.totalValue ? Number(pStats.totalValue) : 0,
      meetingCount: mStats?.meetingCount ?? 0,
      proposalCount: pStats?.proposalCount ?? 0,
      latestActivityAt: mStats?.latestMeetingAt ?? row.projectCreatedAt,
      nextMeetingId: repMap.get(customerId)?.meetingId ?? null,
      nextMeetingAt: null,
      meetingScheduledFor: repMap.get(customerId)?.meetingScheduledFor ?? null,
      assignedRep: repMap.get(customerId)?.rep ?? null,
      proposals: proposalDetailMap.get(customerId) ?? [],
      project: {
        id: row.projectId,
        title: row.projectTitle,
        address: row.projectAddress,
        status: row.projectStatus,
        pipelineStage: row.projectPipelineStage,
        meetingCount: mStats?.meetingCount ?? 0,
        proposalCount: pStats?.proposalCount ?? 0,
        totalValue: pStats?.totalValue ? Number(pStats.totalValue) : 0,
      },
    }
  })
}
