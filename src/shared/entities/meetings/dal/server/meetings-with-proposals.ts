import type { SQL } from 'drizzle-orm'

import type { ScopedContext } from '@/shared/dal/server/types'
import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { and, count, desc, eq, sql } from 'drizzle-orm'

import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import 'server-only'

/**
 * Meetings matching `where`, newest first, each with its proposals: the shape the customer profile and a
 * project's sales history render. Each meeting carries the proposals the actor reaches: an agent sees the
 * proposals of meetings they sit in, a role with no proposal rule sees none.
 */
export async function getMeetingsWithProposals(ctx: ScopedContext, where: SQL): Promise<{ meetings: CustomerProfileMeeting[], proposals: CustomerProfileProposal[] }> {
  const meetingRows = await db
    .select({
      id: meetings.id,
      ownerId: meetings.ownerId,
      customerId: meetings.customerId,
      projectId: meetings.projectId,
      meetingType: meetings.meetingType,
      meetingOutcome: meetings.meetingOutcome,
      scheduledFor: meetings.scheduledFor,
      confirmedAt: meetings.confirmedAt,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .where(where)
    .orderBy(desc(meetings.createdAt))

  const proposalRows = meetingRows.length === 0
    ? []
    : await db
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
          finalTcpCents: proposals.finalTcpCents,
          sowRaw: sql<string | null>`${proposals.projectJSON}->'data'->'sow'`.as('sow_raw'),
          viewCount: count(proposalViews.id).as('view_count'),
        })
        .from(proposals)
        .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
        .where(and(
          sql`${proposals.meetingId} IN (${sql.join(meetingRows.map(m => sql`${m.id}`), sql`, `)})`,
          permit(ctx, 'read', proposalServerSpec).sql,
        ))
        .groupBy(proposals.id)
        .orderBy(desc(proposals.createdAt))

  const allProposals: CustomerProfileProposal[] = proposalRows.map((p) => {
    // Parse SOW JSON into trade+scopes summary
    let sowSummary: CustomerProfileProposal['sowSummary'] = []
    try {
      const rawSow = typeof p.sowRaw === 'string' ? JSON.parse(p.sowRaw) : p.sowRaw
      if (Array.isArray(rawSow)) {
        sowSummary = rawSow
          .filter((entry: any) => entry?.trade?.label)
          .map((entry: any) => ({
            trade: entry.trade.label as string,
            scopes: Array.isArray(entry.scopes)
              ? entry.scopes.filter((s: any) => s?.label && typeof s?.id === 'string').map((s: any) => ({ id: s.id as string, label: s.label as string }))
              : [],
          }))
      }
    }
    catch {
      // Invalid JSON — leave empty
    }

    return {
      id: p.id,
      label: p.label,
      status: p.status,
      token: p.token,
      trade: p.trade,
      // Stored rollup (Wave 2) — maintained by recomputeProposalFinancials; null
      // only pre-backfill.
      value: (p.finalTcpCents ?? 0) / 100,
      sentAt: p.sentAt,
      contractSentAt: p.contractSentAt,
      viewCount: p.viewCount,
      meetingId: p.meetingId,
      createdAt: p.createdAt,
      sowSummary,
    }
  })

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
    customerId: m.customerId,
    projectId: m.projectId,
    meetingType: m.meetingType,
    meetingOutcome: m.meetingOutcome,
    scheduledFor: m.scheduledFor,
    confirmedAt: m.confirmedAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    proposals: proposalsByMeeting.get(m.id) ?? [],
  }))

  return { meetings: meetingsWithProposals, proposals: allProposals }
}
