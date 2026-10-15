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

// A stored amount is only pulled under the max, never snapped to the step: an off-step amount the agent
// entered is a real choice, and opening the page must not rewrite it.
export function clampStoredCashDown(storedCash: number, finalTcp: number): number {
  return Math.min(storedCash, getCashDownBounds(finalTcp).max)
}

export function isPaymentModeAvailable(mode: PaymentMode, finalTcp: number): boolean {
  if (mode === 'all-cash' || mode === 'scheduled') {
    return true
  }
  return getCashDownBounds(finalTcp).canFinance
}

// The proposal form and the meeting handoff store an all-cash deal as a cash down of the whole price;
// compared in cents because the stored column is rounded to the cent and the computed price may not be.
export function coversWholePrice(storedCash: number, finalTcp: number): boolean {
  return Math.round(storedCash * 100) >= Math.round(finalTcp * 100)
}

// Only the cash down is stored until the payment plan is, so a reload infers the mode from it.
export function getStoredPaymentMode(storedCash: number, finalTcp: number): PaymentMode {
  if (!getCashDownBounds(finalTcp).canFinance || coversWholePrice(storedCash, finalTcp)) {
    return 'all-cash'
  }
  return storedCash > 0 ? 'some-cash' : 'all-finance'
}
