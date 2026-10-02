import type { SQL } from 'drizzle-orm'

import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import 'server-only'

/** Meetings matching `where`, newest first, each with its proposals: the shape the customer profile and a project's sales history render. */
export async function getMeetingsWithProposals(where: SQL | undefined): Promise<{ meetings: CustomerProfileMeeting[], proposals: CustomerProfileProposal[] }> {
  const meetingRows = await db
    .select({
      id: meetings.id,
      ownerId: meetings.ownerId,
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
      finalTcpCents: proposals.finalTcpCents,
      sowRaw: sql<string | null>`${proposals.projectJSON}->'data'->'sow'`.as('sow_raw'),
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
