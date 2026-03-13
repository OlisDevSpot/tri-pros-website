import type { MeetingPipelineStage, ProposalPipelineStage } from '@/features/agent-dashboard/constants/pipeline-stages'

import { count, desc, eq, max, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'

// ---------- Meeting pipeline items ----------

export interface MeetingPipelineItem {
  id: string
  type: 'meeting'
  stage: MeetingPipelineStage
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  program: string | null
  createdAt: string
  proposalId: string | null
}

const MEETING_STATUS_TO_STAGE: Record<string, MeetingPipelineStage> = {
  in_progress: 'meeting_set',
  completed: 'meeting_done',
  converted: 'meeting_converted',
}

export async function getMeetingPipelineItems(userId: string): Promise<MeetingPipelineItem[]> {
  const rows = await db
    .select({
      id: meetings.id,
      contactName: meetings.contactName,
      program: meetings.program,
      status: meetings.status,
      createdAt: meetings.createdAt,
      proposalId: meetings.proposalId,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
    })
    .from(meetings)
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .where(eq(meetings.ownerId, userId))
    .orderBy(desc(meetings.createdAt))

  return rows.map(m => ({
    id: m.id,
    type: 'meeting' as const,
    stage: MEETING_STATUS_TO_STAGE[m.status] ?? 'meeting_set',
    customerName: m.customerName ?? m.contactName ?? 'Unknown',
    customerPhone: m.customerPhone ?? null,
    customerEmail: m.customerEmail ?? null,
    program: m.program,
    createdAt: m.createdAt,
    proposalId: m.proposalId,
  }))
}

// ---------- Proposal pipeline items ----------

export interface ProposalPipelineItem {
  id: string
  type: 'proposal'
  stage: ProposalPipelineStage
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  value: number | null
  trade: string | null
  viewCount: number
  sentAt: string | null
  createdAt: string
}

const PROPOSAL_STATUS_TO_STAGE: Record<string, ProposalPipelineStage> = {
  draft: 'proposal_draft',
  sent: 'proposal_sent',
  approved: 'contract_signed',
  declined: 'declined',
}

export async function getProposalPipelineItems(userId: string): Promise<ProposalPipelineItem[]> {
  const rows = await db
    .select({
      id: proposals.id,
      status: proposals.status,
      customerName: sql<string>`COALESCE(${proposals.homeownerJSON}->'data'->>'name', 'Unknown')`.as('customer_name'),
      customerPhone: sql<string | null>`${proposals.homeownerJSON}->'data'->>'phoneNum'`.as('customer_phone'),
      customerEmail: sql<string | null>`${proposals.homeownerJSON}->'data'->>'email'`.as('customer_email'),
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'trade'->>'label'`.as('trade'),
      finalTcp: sql<number | null>`(${proposals.fundingJSON}->'data'->>'finalTcp')::numeric`.as('final_tcp'),
      sentAt: proposals.sentAt,
      createdAt: proposals.createdAt,
      viewCount: count(proposalViews.id),
      lastViewedAt: max(proposalViews.viewedAt),
    })
    .from(proposals)
    .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
    .where(eq(proposals.ownerId, userId))
    .groupBy(proposals.id)
    .orderBy(desc(proposals.createdAt))

  return rows.map(p => ({
    id: p.id,
    type: 'proposal' as const,
    stage: PROPOSAL_STATUS_TO_STAGE[p.status] ?? 'proposal_draft',
    customerName: p.customerName ?? 'Unknown',
    customerPhone: p.customerPhone,
    customerEmail: p.customerEmail,
    value: p.finalTcp != null ? Number(p.finalTcp) : null,
    trade: p.trade,
    viewCount: p.viewCount,
    sentAt: p.sentAt,
    createdAt: p.createdAt,
  }))
}

// Union type for components that handle both
export type PipelineItem = MeetingPipelineItem | ProposalPipelineItem
