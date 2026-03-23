import { and, count, desc, eq, max, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'

type ActionTier = 'HOT_NOW' | 'HOT_LEAD' | 'FOLLOW_UP_DUE' | 'STALE' | 'NO_PROPOSAL'

export interface ActionItem {
  id: string
  type: 'proposal' | 'meeting'
  tier: ActionTier
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  program: string | null
  trade: string | null
  viewCount: number
  lastViewedAt: string | null
  sentAt: string | null
  daysSinceSent: number | null
  meetingDate: string | null
  proposalId: string | null
  cadenceDay: number | null
  suggestedAction: string
}

const CADENCE_DAYS = [1, 3, 7, 14] as const

function getSuggestedAction(tier: ActionTier, cadenceDay: number | null): string {
  switch (tier) {
    case 'HOT_NOW':
      return 'Call now — they\'re reading your proposal'
    case 'HOT_LEAD':
      return 'High interest — follow up today'
    case 'FOLLOW_UP_DUE':
      switch (cadenceDay) {
        case 1:
          return 'Check if they received the proposal'
        case 3:
          return 'Send a value-add touch (project photo, testimonial)'
        case 7:
          return 'Urgency touch — mention incentive expiration'
        case 14:
          return 'Nurture — seasonal relevance or new promotion'
        default:
          return 'Follow up with the customer'
      }
    case 'STALE':
      return 'Likely didn\'t receive it — call to confirm, check spam'
    case 'NO_PROPOSAL':
      return 'Meeting done — create the proposal'
  }
}

function classifyProposal(
  viewCount: number,
  lastViewedAt: string | null,
  sentAt: string | null,
): { tier: ActionTier, cadenceDay: number | null } {
  const now = Date.now()

  // Check HOT_NOW: viewed within last 2 hours
  if (lastViewedAt) {
    const minutesSinceLastView = (now - new Date(lastViewedAt).getTime()) / 60000
    if (minutesSinceLastView <= 120) {
      return { tier: 'HOT_NOW', cadenceDay: null }
    }
  }

  // Check HOT_LEAD: 3+ total views
  if (viewCount >= 3) {
    return { tier: 'HOT_LEAD', cadenceDay: null }
  }

  // Check follow-up cadence and stale
  if (sentAt) {
    const daysSinceSent = Math.floor((now - new Date(sentAt).getTime()) / 86400000)

    // Check FOLLOW_UP_DUE: matches cadence day ± 1
    for (const day of CADENCE_DAYS) {
      if (Math.abs(daysSinceSent - day) <= 1) {
        return { tier: 'FOLLOW_UP_DUE', cadenceDay: day }
      }
    }

    // Check STALE: sent 2+ days ago with 0 views
    if (daysSinceSent >= 2 && viewCount === 0) {
      return { tier: 'STALE', cadenceDay: null }
    }
  }

  // Default to FOLLOW_UP_DUE with nearest cadence day
  if (sentAt) {
    const daysSinceSent = Math.floor((now - new Date(sentAt).getTime()) / 86400000)
    const nearestDay = CADENCE_DAYS.reduce((prev, curr) =>
      Math.abs(curr - daysSinceSent) < Math.abs(prev - daysSinceSent) ? curr : prev,
    )
    return { tier: 'FOLLOW_UP_DUE', cadenceDay: nearestDay }
  }

  return { tier: 'FOLLOW_UP_DUE', cadenceDay: null }
}

const TIER_ORDER: Record<ActionTier, number> = {
  HOT_NOW: 1,
  HOT_LEAD: 2,
  FOLLOW_UP_DUE: 3,
  STALE: 4,
  NO_PROPOSAL: 5,
}

export async function getActionQueue(userId: string, isOmni = false): Promise<ActionItem[]> {
  // 1. Sent proposals with view data
  const sentProposals = await db
    .select({
      id: proposals.id,
      customerName: sql<string>`COALESCE(${customers.name}, 'Unknown')`.as('customer_name'),
      customerPhone: sql<string | null>`${customers.phone}`.as('customer_phone'),
      customerEmail: sql<string | null>`${customers.email}`.as('customer_email'),
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'trade'->>'label'`.as('trade'),
      sentAt: proposals.sentAt,
      viewCount: count(proposalViews.id),
      lastViewedAt: max(proposalViews.viewedAt),
    })
    .from(proposals)
    .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
    .where(and(
      isOmni ? undefined : eq(proposals.ownerId, userId),
      eq(proposals.status, 'sent'),
    ))
    .groupBy(proposals.id, customers.name, customers.phone, customers.email)
    .orderBy(desc(proposals.sentAt))

  // 2. Completed meetings without proposals
  const orphanMeetings = await db
    .select({
      id: meetings.id,
      customerName: sql<string>`COALESCE(${customers.name}, ${meetings.contactName}, 'Unknown')`.as('customer_name'),
      program: meetings.program,
      createdAt: meetings.createdAt,
    })
    .from(meetings)
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .where(and(
      isOmni ? undefined : eq(meetings.ownerId, userId),
      eq(meetings.status, 'completed'),
    ))
    .orderBy(desc(meetings.createdAt))

  // 3. Build action items from proposals
  const proposalActions: ActionItem[] = sentProposals.map((p) => {
    const { tier, cadenceDay } = classifyProposal(
      p.viewCount,
      p.lastViewedAt,
      p.sentAt,
    )
    const daysSinceSent = p.sentAt
      ? Math.floor((Date.now() - new Date(p.sentAt).getTime()) / 86400000)
      : null

    return {
      id: p.id,
      type: 'proposal',
      tier,
      customerName: p.customerName ?? 'Unknown',
      customerPhone: p.customerPhone,
      customerEmail: p.customerEmail,
      program: null,
      trade: p.trade,
      viewCount: p.viewCount,
      lastViewedAt: p.lastViewedAt,
      sentAt: p.sentAt,
      daysSinceSent,
      meetingDate: null,
      proposalId: p.id,
      cadenceDay,
      suggestedAction: getSuggestedAction(tier, cadenceDay),
    }
  })

  // 4. Build action items from orphan meetings
  const meetingActions: ActionItem[] = orphanMeetings.map(m => ({
    id: m.id,
    type: 'meeting',
    tier: 'NO_PROPOSAL' as const,
    customerName: m.customerName,
    customerPhone: null,
    customerEmail: null,
    program: m.program,
    trade: null,
    viewCount: 0,
    lastViewedAt: null,
    sentAt: null,
    daysSinceSent: null,
    meetingDate: m.createdAt,
    proposalId: null,
    cadenceDay: null,
    suggestedAction: getSuggestedAction('NO_PROPOSAL', null),
  }))

  // 5. Combine and sort by tier priority, then recency within tier
  const allActions = [...proposalActions, ...meetingActions]
  allActions.sort((a, b) => {
    const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
    if (tierDiff !== 0) {
      return tierDiff
    }

    // Within same tier, most recent first
    const aDate = a.sentAt ?? a.meetingDate ?? ''
    const bDate = b.sentAt ?? b.meetingDate ?? ''
    return bDate.localeCompare(aDate)
  })

  return allActions
}
