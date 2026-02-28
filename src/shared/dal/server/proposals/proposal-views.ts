import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalViews } from '@/shared/db/schema/proposal-views'

export async function recordProposalView(data: InsertProposalView): Promise<ProposalView> {
  const [view] = await db.insert(proposalViews).values(data).returning()
  return view!
}

export interface ProposalViewStats {
  totalViews: number
  lastViewedAt: string | null
  emailViews: number
  directViews: number
  views: ProposalView[]
}

export async function getProposalViews(proposalId: string): Promise<ProposalViewStats> {
  const views = await db
    .select()
    .from(proposalViews)
    .where(eq(proposalViews.proposalId, proposalId))
    .orderBy(desc(proposalViews.viewedAt))

  const totalViews = views.length
  const lastViewedAt = views[0]?.viewedAt ?? null
  const emailViews = views.filter(v => v.source === 'email').length
  const directViews = views.filter(v => v.source === 'direct').length

  return { totalViews, lastViewedAt, emailViews, directViews, views }
}
