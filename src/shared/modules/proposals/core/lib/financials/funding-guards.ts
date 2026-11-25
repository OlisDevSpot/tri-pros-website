import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/proposal-refusals'
import { isAllowedCashDown } from './cash-down'
import { getDepositCap, resolveDeposit } from './deposit'

export function depositRefusal(depositAmountCents: number, finalTcpCents: number | null): string | null {
  return depositAmountCents > Math.round(getDepositCap((finalTcpCents ?? 0) / 100) * 100) ? PROPOSAL_REFUSALS.depositOverCap : null
}

export function cashDownRefusal(cashInDealCents: number, row: { finalTcpCents: number | null, depositAmountCents: number | null }): string | null {
  const finalTcp = (row.finalTcpCents ?? 0) / 100
  const deposit = resolveDeposit(row.depositAmountCents == null ? null : row.depositAmountCents / 100, finalTcp)
  return isAllowedCashDown(cashInDealCents / 100, finalTcp, deposit) ? null : PROPOSAL_REFUSALS.invalidCashDown
}

/** A copied deposit above the cap for the copy's price is dropped, so the copy follows the cap instead of being refused. */
export function depositWithinCapOrNull(depositAmountCents: number | null, finalTcpCents: number | null): number | null {
  return depositAmountCents != null && depositRefusal(depositAmountCents, finalTcpCents) == null ? depositAmountCents : null
}

interface ProposalFundingWrite {
  startingTcpCents?: number | null
  projectJSON?: unknown
  depositAmountCents?: number | null
  cashInDealCents?: number | null
}

// Read by value, not key: superjson and a partial zod schema keep a key sent as `undefined`, and the write skips it, so
// such a key moves nothing and must not excuse the checks below.
export function writeMovesPrice(input: ProposalFundingWrite): boolean {
  return input.startingTcpCents !== undefined || input.projectJSON !== undefined
}

/**
 * The funding values an update must check against the stored price; null means nothing to check. A write that also
 * moves the price is the edit view's, which clamps against the new price. An empty deposit means the cap, which always
 * fits; an empty cash down is read as $0 everywhere, so it is checked as $0.
 */
export function fundingValuesToCheck(input: ProposalFundingWrite): { depositAmountCents: number | null, cashInDealCents: number | null } {
  if (writeMovesPrice(input)) {
    return { depositAmountCents: null, cashInDealCents: null }
  }
  return {
    depositAmountCents: input.depositAmountCents ?? null,
    cashInDealCents: input.cashInDealCents === undefined ? null : (input.cashInDealCents ?? 0),
  }
}
