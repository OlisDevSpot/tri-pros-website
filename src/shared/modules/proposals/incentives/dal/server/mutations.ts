// proposal_incentives multi-row write (Wave 2): the delete-all + insert-all of a
// proposal's GLOBAL rows in one transaction — the ONLY incentive write the CRUD
// engine cannot express. Pure data operation: no scope, no lock gate, no rollup
// re-drive. Those are orchestration and live on the incentives SERVICE
// (`proposalIncentivesService.replace`), which reads the parent through the
// proposal service's `core.getById` (scoped), applies the lock ladder, calls
// this, and re-drives `final_tcp_cents`. Single-row writes go through
// `proposalIncentiveCrud` (crud.ts).
// see ../../../core/DOCS.md#final-tcp-derived

import type { DalReturn } from '@/shared/dal/server/types'
import type { InsertProposalIncentive } from '@/shared/db/schema/proposal-incentives'

import { and, eq, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'

/** Atomic replace of a proposal's GLOBAL incentive rows (sow_item_id IS NULL). Returns the count written. */
export async function replaceGlobalIncentiveRows(
  proposalId: string,
  rows: InsertProposalIncentive[],
): Promise<DalReturn<number>> {
  return dalDbOperation(async () => {
    await db.transaction(async (tx) => {
      await tx.delete(proposalIncentives).where(and(
        eq(proposalIncentives.proposalId, proposalId),
        isNull(proposalIncentives.sowItemId),
      ))
      if (rows.length > 0) {
        await tx.insert(proposalIncentives).values(rows)
      }
    })
    return rows.length
  })
}
