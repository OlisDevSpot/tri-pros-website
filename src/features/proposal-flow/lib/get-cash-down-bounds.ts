import { CASH_DOWN_STEP, MIN_FINANCED_AMOUNT } from '@/shared/modules/proposals/core/constants/financing'

export type PaymentMode = 'all-cash' | 'some-cash' | 'all-finance' | 'scheduled'

export interface CashDownBounds { max: number, canFinance: boolean }

export function getCashDownBounds(finalTcp: number): CashDownBounds {
  const room = finalTcp - MIN_FINANCED_AMOUNT
  const max = Math.max(0, Math.floor(room / CASH_DOWN_STEP) * CASH_DOWN_STEP)
  return { max, canFinance: room >= CASH_DOWN_STEP }
}

export function clampCashDown(value: number, finalTcp: number): number {
  const { max } = getCashDownBounds(finalTcp)
  const stepped = Math.floor(Math.max(0, value) / CASH_DOWN_STEP) * CASH_DOWN_STEP
  return Math.min(stepped, max)
}

export function isPaymentModeAvailable(mode: PaymentMode, finalTcp: number): boolean {
  if (mode === 'all-cash' || mode === 'scheduled') {
    return true
  }
  return getCashDownBounds(finalTcp).canFinance
}

// Only the cash down is stored until the payment plan is, so a reload infers the mode from it.
export function getStoredPaymentMode(storedCash: number, finalTcp: number): PaymentMode {
  if (!getCashDownBounds(finalTcp).canFinance) {
    return 'all-cash'
  }
  return storedCash > 0 ? 'some-cash' : 'all-finance'
}
