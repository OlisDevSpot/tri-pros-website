import { CASH_DOWN_STEP, MIN_FINANCED_AMOUNT } from '@/shared/modules/proposals/core/constants/financing'

// The stored column is rounded to the cent and the computed price may not be, so every comparison is in cents.
function cents(value: number): number {
  return Math.round(value * 100)
}

// A value sent to the server is cent-rounded first: 30000 − 2499.99 is 27500.010000000002, which never equals the
// stored 27500.01, so an unrounded all-cash value would be saved again on every visit.
export function roundToCents(value: number): number {
  return cents(value) / 100
}

export function getMaxFinancedCashDown(finalTcp: number): number {
  return finalTcp - MIN_FINANCED_AMOUNT
}

/** The deposit, then every step above it that still leaves the financing minimum. Empty when the deposit alone leaves too little. */
export function getCashDownStops(finalTcp: number, deposit: number): number[] {
  const limit = cents(getMaxFinancedCashDown(finalTcp))
  if (cents(deposit) > limit) {
    return []
  }
  const stops = [deposit]
  for (let value = (Math.floor(deposit / CASH_DOWN_STEP) + 1) * CASH_DOWN_STEP; cents(value) <= limit; value += CASH_DOWN_STEP) {
    stops.push(value)
  }
  return stops
}

export function canFinance(finalTcp: number, deposit: number): boolean {
  return cents(deposit) <= cents(getMaxFinancedCashDown(finalTcp))
}

export function isAllCash(cashInDeal: number, finalTcp: number): boolean {
  return cents(cashInDeal) >= cents(finalTcp)
}

export function isAllowedCashDown(cashInDeal: number, finalTcp: number, deposit: number): boolean {
  if (cents(cashInDeal) === cents(finalTcp)) {
    return true
  }
  return cents(cashInDeal) >= cents(deposit) && cents(cashInDeal) <= cents(getMaxFinancedCashDown(finalTcp))
}

// Pulled inside the bounds, never snapped to a stop: an off-step amount the agent entered is a real choice.
export function clampFinancedCashDown(cashInDeal: number, finalTcp: number, deposit: number): number {
  return Math.min(Math.max(cashInDeal, deposit), getMaxFinancedCashDown(finalTcp))
}

export function getDefaultCashDown(finalTcp: number, deposit: number): number {
  return canFinance(finalTcp, deposit) ? deposit : finalTcp
}

export function nearestStopIndex(value: number, stops: number[]): number {
  let best = 0
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(stops[i]! - value) < Math.abs(stops[best]! - value)) {
      best = i
    }
  }
  return best
}

export function getCashDownPreset(percent: number, finalTcp: number, stops: number[]): { value: number, disabled: boolean } {
  const wanted = finalTcp * percent / 100
  const last = stops.at(-1)
  if (last === undefined) {
    return { value: finalTcp, disabled: true }
  }
  return { value: stops[nearestStopIndex(wanted, stops)]!, disabled: wanted > last + CASH_DOWN_STEP / 2 }
}
