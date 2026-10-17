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
