import { formatAsDollars, formatAsPercent } from '@/shared/lib/formatters'
import { DEPOSIT_CAP_AMOUNT, DEPOSIT_CAP_RATE } from '@/shared/modules/proposals/core/constants/financing'

export function getDepositCap(finalTcp: number): number {
  const cap = Math.min(DEPOSIT_CAP_AMOUNT, Math.max(0, finalTcp) * DEPOSIT_CAP_RATE)
  return Math.floor(Math.round(cap * 1000) / 10) / 100
}

/** A stored deposit is an agent override; an empty one means the cap. Neither can exceed the cap for the current price. */
export function resolveDeposit(stored: number | null, finalTcp: number): number {
  const cap = getDepositCap(finalTcp)
  return stored == null ? cap : Math.min(Math.max(0, stored), cap)
}

/** The cap in words, built from the constants so the copy can't drift from the rule. */
export function describeDepositCap(): string {
  return `${formatAsDollars(DEPOSIT_CAP_AMOUNT)} or ${formatAsPercent(DEPOSIT_CAP_RATE * 100)} of the price, whichever is less`
}
