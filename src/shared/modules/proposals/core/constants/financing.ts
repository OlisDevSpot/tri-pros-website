// Lenders won't originate a home-improvement loan below this amount.
export const MIN_FINANCED_AMOUNT = 3500
export const CASH_DOWN_STEP = 200
// Cal. Bus. & Prof. Code §7159.5(a)(3): the down payment may not exceed $1,000 or 10% of the contract price, whichever is less.
export const DEPOSIT_CAP_AMOUNT = 1000
export const DEPOSIT_CAP_RATE = 0.1
export const CASH_DOWN_PRESET_PERCENTS = [10, 20, 30, 50] as const
