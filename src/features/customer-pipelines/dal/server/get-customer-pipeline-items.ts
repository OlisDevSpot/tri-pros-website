import type { CustomerPipelineItem, CustomerPipelineRawData } from '@/features/customer-pipelines/types'

import type { CustomerPipeline } from '@/shared/types/enums'

import { and, count, desc, eq, inArray, max, sql } from 'drizzle-orm'

import { computeCustomerStage } from '@/features/customer-pipelines/lib/compute-customer-stage'
import { db } from '@/shared/db'
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
      totalPipelineValue: 0,
      meetingCount: 0,
      proposalCount: 0,
      latestActivityAt: '',
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
      meetingCount: count(meetings.id).as('meeting_count'),
      hasScheduledFutureMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} > now())`.as('has_future_scheduled'),
      hasActiveMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() AND ${meetings.scheduledFor} > now() - interval '2 hours')`.as('has_active'),
      hasPastMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() - interval '2 hours' OR (${meetings.scheduledFor} IS NULL AND ${meetings.status} IN ('completed', 'converted')))`.as('has_past'),
      latestMeetingAt: max(meetings.createdAt).as('latest_meeting_at'),
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
      totalPipelineValue: rawData.totalPipelineValue,
      meetingCount: rawData.meetingCount,
      proposalCount: rawData.proposalCount,
      latestActivityAt: rawData.latestActivityAt,
    }
  })
}
