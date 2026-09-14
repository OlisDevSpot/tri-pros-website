// proposal_incentives child-table writes (Wave 2). Replace-all upsert from the
// funding form + the duplicate-clone. Both gate through / re-drive the parent's
// financial rollup, which stays proposal-owned (imported back here).
// see ../../../core/DOCS.md#proposal-lock-ladder

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalIncentive, ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'
import type { Incentive } from '@/shared/modules/proposals/core/schemas'

import { and, eq, isNull } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'
import { proposals } from '@/shared/db/schema/proposals'
import { recomputeProposalFinancials } from '@/shared/modules/proposals/core/dal/server/mutations'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { listProposalIncentives } from '@/shared/modules/proposals/incentives/dal/server/queries'
import { domainIncentivesToRows } from '@/shared/modules/proposals/incentives/lib/incentive-rows'

/**
 * Replace-all upsert of GLOBAL incentives (funding-form save path — the W2
 * slice of the W3 form refactor, spec §3 W2.3). Lock gate: refuses while the
 * proposal is anywhere on the lock ladder (`isProposalFrozen` — draft
 * envelope exists, contract in flight, or terminal). The sanctioned edit
 * path discards/recalls the envelope first (#264).
 * see ../../../core/DOCS.md#proposal-lock-ladder
 */
export async function replaceProposalIncentives(
  ctx: ScopedContext,
  input: { proposalId: string, incentives: Incentive[] },
): Promise<DalReturn<ProposalIncentiveRow[]>> {
  return dalDbOperation(async () => {
    const [proposal] = await db
      .select({
        id: proposals.id,
        status: proposals.status,
        contractEnvelopeId: proposals.contractEnvelopeId,
        contractSentAt: proposals.contractSentAt,
        contractSignedAt: proposals.contractSignedAt,
        contractDeclinedAt: proposals.contractDeclinedAt,
      })
      .from(proposals)
      .where(and(eq(proposals.id, input.proposalId), ctx.scope ?? undefined))
    if (!proposal) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (isProposalFrozen(proposal)) {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
    }
    const rows = domainIncentivesToRows(input.proposalId, input.incentives)
    await db.transaction(async (tx) => {
      await tx.delete(proposalIncentives).where(and(
        eq(proposalIncentives.proposalId, input.proposalId),
        isNull(proposalIncentives.sowItemId),
      ))
      if (rows.length > 0) {
        await tx.insert(proposalIncentives).values(rows)
      }
    })
    dalVerifySuccess(await recomputeProposalFinancials(input.proposalId))
    return dalVerifySuccess(await listProposalIncentives(input.proposalId))
  })
}

/**
 * Clone the source proposal's GLOBAL incentive rows onto the target. Returns the
 * count cloned so the duplicate override only re-drives the rollup when rows
 * existed (preserving the pre-relocation control flow). The financial recompute
 * stays with the caller (proposal orchestration).
 * see ../../../core/DOCS.md#duplicate-resets-and-redrives
 */
export async function cloneProposalIncentives(
  sourceId: string,
  targetId: string,
): Promise<DalReturn<number>> {
  return dalDbOperation(async () => {
    const source = dalVerifySuccess(await listProposalIncentives(sourceId))
    if (source.length === 0) {
      return 0
    }
    const rows: InsertProposalIncentive[] = source.map(row => ({
      proposalId: targetId,
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
    return rows.length
  })
}
