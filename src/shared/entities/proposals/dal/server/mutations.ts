// Proposal entity DAL mutations. Business-specific operations beyond CRUD.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'
import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'
import type { Incentive } from '@/shared/entities/proposals/schemas'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { listProposalIncentives } from '@/shared/entities/proposals/dal/server/queries'
import { domainIncentivesToRows } from '@/shared/entities/proposals/lib/incentive-rows'
import { isProposalFrozen } from '@/shared/entities/proposals/lib/proposal-lock'
import { scrubBlobIncentives } from '@/shared/entities/proposals/lib/scrub-blob-incentives'

// ── recordProposalView ─────────────────────────────────────────────────

/** Records a proposal view event. Called from the public recordView procedure on homeowner open. */
export async function recordProposalView(
  input: InsertProposalView,
): Promise<DalReturn<ProposalView>> {
  return dalDbOperation(async () => {
    const [view] = await db.insert(proposalViews).values(input).returning()
    if (!view) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return view
  })
}

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

// ── replaceProposalIncentives ────────────────────────────────────────────

/**
 * Replace-all upsert of GLOBAL incentives (funding-form save path — the W2
 * slice of the W3 form refactor, spec §3 W2.3). Lock gate: refuses while the
 * proposal is anywhere on the lock ladder (`isProposalFrozen` — draft
 * envelope exists, contract in flight, or terminal). The sanctioned edit
 * path discards/recalls the envelope first (#264).
 * see ../../DOCS.md#proposal-lock-ladder
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
