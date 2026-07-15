// Duplicate override for the proposals CRUD router (final-review fix, I1).
//
// Lives in its own file — ABOVE both `crud.ts` and `mutations.ts` — on
// purpose: `crud.ts` imports `server-spec.ts`, which imports `mutations.ts`
// (for `recomputeProposalFinancials`). If this override lived in
// `mutations.ts` and imported `proposalCrud` from `crud.ts`, that would
// close the cycle crud → server-spec → mutations → crud. This file imports
// both crud and mutations without being imported by either, so it sits
// above them in the dependency graph.

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalIncentive } from '@/shared/db/schema/proposal-incentives'
import type { Proposal } from '@/shared/db/schema/proposals'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { recomputeProposalFinancials } from '@/shared/entities/proposals/dal/server/mutations'
import { listProposalIncentives } from '@/shared/entities/proposals/dal/server/queries'

/**
 * Duplicate override — clones the source proposal's GLOBAL incentive rows
 * onto the new copy, then re-converges `final_tcp_cents`.
 *
 * The generic `duplicateImpl` (createCrudDal) only copies `spec.table` — it
 * never touches Wave-2 child tables — and `create.after` recomputes the new
 * proposal's rollup against zero `proposal_incentives` rows. Without this
 * override, duplicating a proposal that has discounts/exclusive-offers
 * silently drops them and overstates the duplicated price.
 * see ../../DOCS.md#duplicate-resets-and-redrives
 */
export async function duplicateProposalWithIncentives(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<Proposal>> {
  return dalDbOperation(async () => {
    const duplicated = dalVerifySuccess(await proposalCrud.duplicate(ctx, input))

    const sourceIncentives = dalVerifySuccess(await listProposalIncentives(input.id))
    if (sourceIncentives.length === 0) {
      return duplicated
    }

    const rows: InsertProposalIncentive[] = sourceIncentives.map(row => ({
      proposalId: duplicated.id,
      sowItemId: null,
      type: row.type,
      position: row.position,
      label: row.label,
      amountCents: row.amountCents,
      offer: row.offer,
      notes: row.notes,
      expiresAt: row.expiresAt,
    }))
    await db.insert(proposalIncentives).values(rows)

    // `create.after` already ran `recomputeProposalFinancials` once, against
    // zero incentive rows — `duplicated.finalTcpCents` reflects that stale
    // value. Re-run now that the copied rows exist and merge the fresh
    // rollup into the returned row (avoid a second full getById round trip).
    const { finalTcpCents } = dalVerifySuccess(await recomputeProposalFinancials(duplicated.id))
    return { ...duplicated, finalTcpCents }
  })
}
