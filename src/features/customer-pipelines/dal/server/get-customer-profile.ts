import type { CustomerProfileData, CustomerProfileMeeting, CustomerProfileProposal, CustomerProfileProposalView } from '@/features/customer-pipelines/types'

import { TRPCError } from '@trpc/server'
import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'
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
      ownerId: meetings.ownerId,
      meetingType: meetings.meetingType,
      meetingOutcome: meetings.meetingOutcome,
      scheduledFor: meetings.scheduledFor,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .where(eq(meetings.customerId, customerId))
    .orderBy(desc(meetings.createdAt))

  const proposalRows = await db
    .select({
      id: proposals.id,
      label: proposals.label,
      status: proposals.status,
      token: proposals.token,
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
    token: p.token,
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
    ownerId: m.ownerId,
    meetingType: m.meetingType,
    meetingOutcome: m.meetingOutcome,
    scheduledFor: m.scheduledFor,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    proposals: proposalsByMeeting.get(m.id) ?? [],
  }))

  const noteRows = await db
    .select()
    .from(customerNotes)
    .where(eq(customerNotes.customerId, customerId))
    .orderBy(desc(customerNotes.createdAt))

  const proposalViewRows: CustomerProfileProposalView[] = allProposals.length > 0
    ? await db
        .select({
          id: proposalViews.id,
          proposalId: proposalViews.proposalId,
          viewedAt: proposalViews.viewedAt,
          source: proposalViews.source,
        })
        .from(proposalViews)
        .where(
          sql`${proposalViews.proposalId} IN (${sql.join(
            allProposals.map(p => sql`${p.id}`),
            sql`, `,
          )})`,
        )
        .orderBy(desc(proposalViews.viewedAt))
    : []

  return {
    customer,
    meetings: meetingsWithProposals,
    allProposals,
    notes: noteRows,
    proposalViews: proposalViewRows,
  }
}
