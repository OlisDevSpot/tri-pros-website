import type { DealStructure } from '@/shared/entities/meetings/schemas'

/**
 * Derived-value helpers for a meeting's `dealStructure` scratchpad.
 *
 * None of these values are persisted on the meeting — they are pure
 * functions of stored inputs (`startingTcp`, `incentives`, `apr`, etc.)
 * and must be computed on read. Mirrors the pattern established for
 * proposals (`entities/proposals/lib/compute-final-tcp`).
 */

/**
 * Final TCP at the meeting stage:
 *
 *     max(0, startingTcp − Σ incentive.amount)
 *
 * Every incentive on the meeting's deal structure is a discount
 * (`DealStructureIncentive` has no discriminator — it's always an amount
 * deduction). Unlike the proposal schema, there are no exclusive-offer
 * variants to filter out.
 */
export function computeDealFinalTcp(deal: DealStructure | null | undefined): number {
  if (!deal) {
    return 0
  }
  const startingTcp = deal.startingTcp ?? 0
  const deductions = (deal.incentives ?? []).reduce((sum, inc) => sum + (inc.amount ?? 0), 0)
  return Math.max(0, startingTcp - deductions)
}

/**
 * Amortized monthly payment for the finance mode:
 *
 *     monthlyPayment = (P · r) / (1 − (1 + r)^−n)
 *
 * where P = finalTcp, r = apr / 100 / 12, n = termMonths.
 * Zero-interest loans fall back to simple division (P / n).
 *
 * Returns 0 when any input is missing or mode is not 'finance'.
 */
export function computeDealMonthlyPayment(deal: DealStructure | null | undefined): number {
  if (!deal || deal.mode !== 'finance') {
    return 0
  }
  const finalTcp = computeDealFinalTcp(deal)
  const apr = deal.apr ?? 0
  const termMonths = deal.financeTermMonths ?? 0
  if (finalTcp <= 0 || termMonths <= 0) {
    return 0
  }
  if (apr === 0) {
    return finalTcp / termMonths
  }
  const monthlyRate = apr / 100 / 12
  return (finalTcp * monthlyRate) / (1 - (1 + monthlyRate) ** -termMonths)
}

/**
 * Deposit percentage of the final TCP for cash mode:
 *
 *     round((depositAmount / finalTcp) · 100)
 *
 * Returns 0 when any input is missing, mode is not 'cash', or the
 * final TCP is zero (to avoid division by zero).
 */
export function computeDealDepositPercent(deal: DealStructure | null | undefined): number {
  if (!deal || deal.mode !== 'cash') {
    return 0
  }
  const finalTcp = computeDealFinalTcp(deal)
  const depositAmount = deal.depositAmount ?? 0
  if (finalTcp <= 0 || depositAmount <= 0) {
    return 0
  }
  return Math.round((depositAmount / finalTcp) * 100)
}
