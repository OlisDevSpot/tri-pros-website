// proposal_views DAL — queries. View stats for a proposal.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProposalView } from '@/shared/db/schema/proposal-views'

import { desc, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { isInScope } from '@/shared/dal/server/lib/scope'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

export interface ProposalViewStats {
  totalViews: number
  lastViewedAt: string | null
  emailViews: number
  directViews: number
  views: ProposalView[]
}

/**
 * View stats for a proposal: total, last-viewed, source breakdown, raw records
 * (newest first). Parent-visibility scoped — only an agent who can see the
 * proposal (participates in its meeting) + super-admin (omni) may read its
 * views. Delegates to the parent proposal spec (S3b); moves onto the
 * subEntitySpec engine in S5.
 */
export async function getProposalViews(
  ctx: ScopedContext,
  input: { proposalId: string },
): Promise<DalReturn<ProposalViewStats>> {
  return dalDbOperation(async () => {
    if (!(await isInScope(proposalServerSpec, ctx, input.proposalId))) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    const views = await db
      .select()
      .from(proposalViews)
      .where(eq(proposalViews.proposalId, input.proposalId))
      .orderBy(desc(proposalViews.viewedAt))

    return {
      totalViews: views.length,
      lastViewedAt: views[0]?.viewedAt ?? null,
      emailViews: views.filter(v => v.source === 'email').length,
      directViews: views.filter(v => v.source === 'direct').length,
      views,
    }
  })
}
