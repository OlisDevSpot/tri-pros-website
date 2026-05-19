import type { DealStructure } from '@/shared/entities/meetings/schemas'

/**
 * Derived-value helpers for a meeting's `dealStructure` scratchpad.
 * Pure functions; never persisted. see ../DOCS.md#dealStructure-derived-helpers
 */

/** Final TCP: max(0, startingTcp − Σ incentive.amount). All incentives are discounts at the meeting stage. */
export function computeDealFinalTcp(deal: DealStructure | null | undefined): number {
  if (!deal) {
    return 0
  }
  const startingTcp = deal.startingTcp ?? 0
  const deductions = (deal.incentives ?? []).reduce((sum, inc) => sum + (inc.amount ?? 0), 0)
  return Math.max(0, startingTcp - deductions)
}

/**
 * Amortized monthly when mode === 'finance':
 *   monthlyPayment = (P · r) / (1 − (1 + r)^−n)
 * where P = finalTcp, r = apr / 100 / 12, n = termMonths.
 * Zero-interest falls back to P / n. Returns 0 if any input missing or mode != 'finance'.
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
 * Deposit % of finalTcp when mode === 'cash': round(depositAmount / finalTcp * 100).
 * Returns 0 if any input missing, mode != 'cash', or finalTcp is 0.
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
