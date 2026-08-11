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
 * DOCUMENTED W2 jsonb residue, confined to THIS statement only (both die in
 * W3): startingTcp base from fundingJSON; section-incentives term from
 * projectJSON. Discounts already SUM over proposal_incentives rows.
 * see ../../DOCS.md#final-tcp-derived
 */
export async function recomputeProposalFinancials(
  proposalId: string,
): Promise<DalReturn<{ finalTcpCents: number | null }>> {
  return dalDbOperation(async () => {
    const [row] = await db.update(proposals).set({
      finalTcpCents: sql`GREATEST(0::numeric, (
        ROUND(COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0) * 100)
        - COALESCE((SELECT SUM(pi.amount_cents) FROM proposal_incentives pi
            WHERE pi.proposal_id = ${proposals.id} AND pi.type = 'discount'), 0)
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

    const fundingJSON = scrubBlobIncentives({
      ...proposal.fundingJSON,
      data: { ...proposal.fundingJSON.data, cashInDeal: input.cashInDeal },
    }, `setCashInDeal on proposal ${input.proposalId}`)

    await db.update(proposals).set({ fundingJSON }).where(eq(proposals.id, input.proposalId))
    return { id: proposal.id, cashInDeal: input.cashInDeal }
  })
}
