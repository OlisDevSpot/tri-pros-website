// GLOBAL incentive rows (sow_item_id IS NULL) for a proposal, position-ordered.
// The read half of the replace-all upsert; also the W2→W3 hydration source
// consumed by the proposals `getFullView`. see ../../../core/DOCS.md#final-tcp-derived

import type { DalReturn } from '@/shared/dal/server/types'
import type { ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'

export async function listProposalIncentives(
  proposalId: string,
): Promise<DalReturn<ProposalIncentiveRow[]>> {
  return dalDbOperation(async () => {
    return await db
      .select()
      .from(proposalIncentives)
      .where(and(eq(proposalIncentives.proposalId, proposalId), isNull(proposalIncentives.sowItemId)))
      .orderBy(asc(proposalIncentives.position))
  })
}
