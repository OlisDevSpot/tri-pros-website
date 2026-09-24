// proposal_incentives multi-row writes (Wave 2): the delete-all + insert-all of a
// proposal's GLOBAL rows in one transaction, and the source→target clone built on
// it — the ONLY incentive writes the CRUD engine cannot express. Pure data operation: no scope, no lock gate, no rollup
// re-drive. Those are orchestration and live on the incentives SERVICE
// (`proposalIncentivesService.replace`), which reads the parent through the
// proposal service's `core.getById` (scoped), applies the lock ladder, calls
// this, and re-drives `final_tcp_cents`. Single-row writes go through
// `proposalIncentiveCrud` (crud.ts).

import type { DalReturn } from '@/shared/dal/server/types'
import type { InsertProposalIncentive } from '@/shared/db/schema/proposal-incentives'

import { and, eq, isNull } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'

import { listProposalIncentives } from './queries'

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

/**
 * Copy the source proposal's GLOBAL rows (sow_item_id IS NULL) onto the target,
 * preserving type/position/label/amount/offer/notes/expiresAt, in ONE multi-row
 * write (the same atomic swap `replaceGlobalIncentiveRows` does — on a fresh
 * copy the delete half is a no-op). Pure data operation: no scope, no lock
 * gate, no rollup re-drive — the caller (the proposals `duplicate.after` hook)
 * re-drives once, using the returned count to skip it when nothing was copied.
 * A DAL function (not a service verb) because the hook lives in a DAL module,
 * and a DAL module never imports a service. sow_item_id stays NULL (C61).
 */
export async function cloneGlobalIncentiveRows(
  sourceId: string,
  targetId: string,
): Promise<DalReturn<number>> {
  return dalDbOperation(async () => {
    const source = dalVerifySuccess(await listProposalIncentives(sourceId))
    if (source.length === 0) {
      return 0
    }
    return dalVerifySuccess(await replaceGlobalIncentiveRows(
      targetId,
      source.map(row => ({
        proposalId: targetId,
        sowItemId: null,
        type: row.type,
        position: row.position,
        label: row.label,
        amountCents: row.amountCents,
        offer: row.offer,
        notes: row.notes,
        expiresAt: row.expiresAt,
      })),
    ))
  })
}
