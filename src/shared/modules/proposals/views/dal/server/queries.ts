import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProposalView } from '@/shared/db/schema/proposal-views'

import { and, desc, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

export interface ProposalViewStats {
  totalViews: number
  lastViewedAt: string | null
  emailViews: number
  directViews: number
  views: ProposalView[]
}

/** View stats for a proposal the actor reaches: totals, last view, source breakdown and the rows, newest first. */
export async function getProposalViews(
  ctx: ScopedContext,
  input: { proposalId: string },
): Promise<DalReturn<ProposalViewStats>> {
  return dalDbOperation(async () => {
    if (!(await permit(ctx, 'read', proposalServerSpec).probe(input.proposalId))) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    const views = await db
      .select()
      .from(proposalViews)
      .where(and(eq(proposalViews.proposalId, input.proposalId), permit(ctx, 'read', proposalViewServerSpec).sql))
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
