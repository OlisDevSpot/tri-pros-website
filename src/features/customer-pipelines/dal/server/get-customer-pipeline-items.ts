import type { CustomerPipelineItem, CustomerPipelineRawData, PipelineItemProposal, PipelineItemRep } from '@/features/customer-pipelines/types'

import type { CustomerPipeline } from '@/shared/types/enums'

import { and, count, desc, eq, inArray, max, sql } from 'drizzle-orm'

import { computeCustomerStage } from '@/features/customer-pipelines/lib/compute-customer-stage'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'

export async function getCustomerPipelineItems(userId: string, pipeline: CustomerPipeline = 'active', isOmni = false): Promise<CustomerPipelineItem[]> {
  if (pipeline !== 'active') {
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
      })
      .from(customers)
      .where(eq(customers.pipeline, pipeline))
      .orderBy(desc(customers.updatedAt))

    return rows.map((row): CustomerPipelineItem => ({
      id: row.id,
      type: 'customer',
      stage: (row.pipelineStage ?? (pipeline === 'rehash' ? 'schedule_manager_meeting' : 'mostly_dead')) as CustomerPipelineItem['stage'],
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
    }))
  }

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
      hasPastMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() - interval '2 hours' OR (${meetings.scheduledFor} IS NULL AND ${meetings.meetingOutcome} IN ('proposal_created', 'follow_up_needed', 'not_interested')))`.as('has_past'),
      latestMeetingAt: max(meetings.createdAt).as('latest_meeting_at'),
      nextMeetingAt: sql<string | null>`min(CASE WHEN ${meetings.scheduledFor} > now() - interval '2 hours' THEN ${meetings.scheduledFor} END)`.as('next_meeting_at'),
    })
    .from(customers)
    .leftJoin(meetings, and(
      eq(meetings.customerId, customers.id),
      isOmni ? undefined : eq(meetings.ownerId, userId),
    ))
    .where(eq(customers.pipeline, 'active'))
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
    arr.push({ id: r.proposalId, value: r.value ? Number(r.value) : null, status: r.status, createdAt: r.createdAt })
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
    }
  })
}
