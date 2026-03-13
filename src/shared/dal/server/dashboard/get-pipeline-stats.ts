import { and, count, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'

export interface PipelineStage {
  count: number
  totalValue?: number
}

export interface PipelineStats {
  stages: {
    meetingSet: PipelineStage
    meetingDone: PipelineStage
    proposalSent: PipelineStage
    proposalViewed: PipelineStage
    contractSigned: PipelineStage
  }
  metrics: {
    conversionRate: number
    activePipelineValue: number
  }
}

export async function getPipelineStats(userId: string): Promise<PipelineStats> {
  // Meetings in progress
  const [meetingSetResult] = await db
    .select({ count: count() })
    .from(meetings)
    .where(and(
      eq(meetings.ownerId, userId),
      eq(meetings.status, 'in_progress'),
    ))

  // Completed meetings without proposals
  const [meetingDoneResult] = await db
    .select({ count: count() })
    .from(meetings)
    .where(and(
      eq(meetings.ownerId, userId),
      eq(meetings.status, 'completed'),
      sql`${meetings.proposalId} IS NULL`,
    ))

  // Sent proposals with view counts — single query, split in JS
  const sentProposalsWithViews = await db
    .select({
      id: proposals.id,
      viewCount: count(proposalViews.id),
      finalTcp: sql<number | null>`(${proposals.fundingJSON}->'data'->>'finalTcp')::numeric`.as('final_tcp'),
    })
    .from(proposals)
    .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
    .where(and(
      eq(proposals.ownerId, userId),
      eq(proposals.status, 'sent'),
    ))
    .groupBy(proposals.id)

  // "Sent" = ALL sent proposals (inclusive), "Viewed" = subset that got opened
  const proposalViewedItems = sentProposalsWithViews.filter(p => p.viewCount > 0)

  const allSentValue = sentProposalsWithViews.reduce((sum, p) => sum + Number(p.finalTcp ?? 0), 0)
  const proposalViewedValue = proposalViewedItems.reduce((sum, p) => sum + Number(p.finalTcp ?? 0), 0)

  // Approved/signed proposals
  const approvedProposals = await db
    .select({
      count: count(),
      totalValue: sql<number>`COALESCE(SUM((${proposals.fundingJSON}->'data'->>'finalTcp')::numeric), 0)`.as('total_value'),
    })
    .from(proposals)
    .where(and(
      eq(proposals.ownerId, userId),
      eq(proposals.status, 'approved'),
    ))

  const rawContractSigned = approvedProposals[0] ?? { count: 0, totalValue: 0 }
  const contractSigned = {
    count: rawContractSigned.count,
    totalValue: Number(rawContractSigned.totalValue ?? 0),
  }

  // Total sent for conversion rate
  const [totalSentResult] = await db
    .select({ count: count() })
    .from(proposals)
    .where(and(
      eq(proposals.ownerId, userId),
      sql`${proposals.status} IN ('sent', 'approved')`,
    ))

  const totalSent = totalSentResult?.count ?? 0
  const conversionRate = totalSent > 0 ? contractSigned.count / totalSent : 0
  const activePipelineValue = allSentValue

  return {
    stages: {
      meetingSet: { count: meetingSetResult?.count ?? 0 },
      meetingDone: { count: meetingDoneResult?.count ?? 0 },
      proposalSent: { count: sentProposalsWithViews.length, totalValue: allSentValue },
      proposalViewed: { count: proposalViewedItems.length, totalValue: proposalViewedValue },
      contractSigned: { count: contractSigned.count, totalValue: contractSigned.totalValue },
    },
    metrics: {
      conversionRate,
      activePipelineValue,
    },
  }
}
