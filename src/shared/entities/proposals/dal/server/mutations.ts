// Proposal entity DAL mutations. Business-specific operations beyond CRUD.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, eq, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'
import { isProposalFrozen } from '@/shared/entities/proposals/lib/proposal-lock'
import { scrubBlobIncentives } from '@/shared/entities/proposals/lib/scrub-blob-incentives'

// ── recomputeProposalFinancials ──────────────────────────────────────────

/**
 * THE financial-rollup choke point (Addendum A.2, stage 2). One idempotent
 * SQL statement; re-running always converges from rows (verify = repair).
 * ONE remaining jsonb residue after the W3 write-seam flip: the
 * section-incentives term still reads projectJSON — it dies in W4. The
 * startingTcp base is the `starting_tcp_cents` column; discounts SUM over
 * proposal_incentives rows. The `sow_item_id IS NULL` predicate is a no-op
 * today (every row is global) and pre-lands the W4 double-count guard.
 * see ../../DOCS.md#final-tcp-derived
 */
export async function recomputeProposalFinancials(
  proposalId: string,
): Promise<DalReturn<{ finalTcpCents: number | null }>> {
  return dalDbOperation(async () => {
    const [row] = await db.update(proposals).set({
      finalTcpCents: sql`GREATEST(0::numeric, (
        COALESCE(${proposals.startingTcpCents}, 0)
        - COALESCE((SELECT SUM(pi.amount_cents) FROM proposal_incentives pi
            WHERE pi.proposal_id = ${proposals.id} AND pi.type = 'discount'
              AND pi.sow_item_id IS NULL), 0)
        - COALESCE((SELECT ROUND(SUM((si->>'amount')::numeric) * 100)
            FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
                 jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si), 0)
      ))::bigint`,
    }).where(eq(proposals.id, proposalId)).returning({ finalTcpCents: proposals.finalTcpCents })
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}

// ── setCashInDeal ────────────────────────────────────────────────────────

/**
 * Narrow write for the funding form's cash-down field. Reads the RAW blob
 * (never the getFullView row-hydrated shape) and rewrites only
 * `data.cashInDeal`, replacing the old client-side whole-blob
 * reconstruction that re-persisted hydrated incentives (seam register,
 * jsonb deprecation ledger). W3 turns this into a plain column write.
 * Same lock gate as every content write. see ../../DOCS.md#proposal-lock-ladder
 */
export async function setCashInDeal(
  ctx: ScopedContext,
  input: { proposalId: string, cashInDeal: number },
): Promise<DalReturn<{ id: string, cashInDeal: number }>> {
  return dalDbOperation(async () => {
    const [proposal] = await db
      .select({
        id: proposals.id,
        status: proposals.status,
        contractEnvelopeId: proposals.contractEnvelopeId,
        contractSentAt: proposals.contractSentAt,
        contractSignedAt: proposals.contractSignedAt,
        contractDeclinedAt: proposals.contractDeclinedAt,
        fundingJSON: proposals.fundingJSON,
      })
      .from(proposals)
      .where(and(eq(proposals.id, input.proposalId), ctx.scope ?? undefined))
    if (!proposal) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (isProposalFrozen(proposal)) {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
    }
    // Post-W3-flip rows carry a NULL blob — this writer becomes a column write
    // in Task 8. Until then, fail loudly rather than resurrect a dead envelope.
    if (!proposal.fundingJSON) {
      throw new ThrowableDalError({
        type: 'precondition-failed',
        reason: 'funding_blob_absent — setCashInDeal still writes the frozen fundingJSON blob (flips to cash_in_deal_cents in W3 Task 8)',
      })
    }

    const fundingJSON = scrubBlobIncentives({
      ...proposal.fundingJSON,
      data: { ...proposal.fundingJSON.data, cashInDeal: input.cashInDeal },
    }, `setCashInDeal on proposal ${input.proposalId}`)

    await db.update(proposals).set({ fundingJSON }).where(eq(proposals.id, input.proposalId))
    return { id: proposal.id, cashInDeal: input.cashInDeal }
  })
}
