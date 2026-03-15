import type { CustomerProfileData, CustomerProfileMeeting, CustomerProfileProposal } from '@/features/pipeline/types'

import { TRPCError } from '@trpc/server'
import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'

export async function getCustomerProfile(customerId: string): Promise<CustomerProfileData> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))

  if (!customer) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
  }

  const meetingRows = await db
    .select({
      id: meetings.id,
      program: meetings.program,
      status: meetings.status,
      scheduledFor: meetings.scheduledFor,
      createdAt: meetings.createdAt,
    })
    .from(meetings)
    .where(eq(meetings.customerId, customerId))
    .orderBy(desc(meetings.createdAt))

  const proposalRows = await db
    .select({
      id: proposals.id,
      label: proposals.label,
      status: proposals.status,
      meetingId: proposals.meetingId,
      sentAt: proposals.sentAt,
      contractSentAt: proposals.contractSentAt,
      createdAt: proposals.createdAt,
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'`.as('trade'),
      value: sql<number | null>`(${proposals.fundingJSON}->'data'->>'finalTcp')::numeric`.as('value'),
      viewCount: count(proposalViews.id).as('view_count'),
    })
    .from(proposals)
    .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
    .where(
      sql`${proposals.meetingId} IN (${sql.join(
        meetingRows.length > 0
          ? meetingRows.map(m => sql`${m.id}`)
          : [sql`NULL`],
        sql`, `,
      )})`,
    )
    .groupBy(proposals.id)
    .orderBy(desc(proposals.createdAt))

  const allProposals: CustomerProfileProposal[] = proposalRows.map(p => ({
    id: p.id,
    label: p.label,
    status: p.status,
    trade: p.trade,
    value: p.value != null ? Number(p.value) : null,
    sentAt: p.sentAt,
    contractSentAt: p.contractSentAt,
    viewCount: p.viewCount,
    meetingId: p.meetingId,
    createdAt: p.createdAt,
  }))

  const proposalsByMeeting = new Map<string, CustomerProfileProposal[]>()
  for (const p of allProposals) {
    if (p.meetingId) {
      const existing = proposalsByMeeting.get(p.meetingId) ?? []
      existing.push(p)
      proposalsByMeeting.set(p.meetingId, existing)
    }
  }

  const meetingsWithProposals: CustomerProfileMeeting[] = meetingRows.map(m => ({
    id: m.id,
    program: m.program,
    status: m.status,
    scheduledFor: m.scheduledFor,
    createdAt: m.createdAt,
    proposals: proposalsByMeeting.get(m.id) ?? [],
  }))

  return {
    customer,
    meetings: meetingsWithProposals,
    allProposals,
  }
}
