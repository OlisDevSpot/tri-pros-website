import type { PriceQuoteInput, SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { priceQuote } from '@/features/calculators/scope-pricing-calculator/lib/price-quote'

export function solveMultiplier(targetTotal: number, input: PriceQuoteInput): SolveMultiplierResult {
  const quote = priceQuote(input)
  if (quote.totalCost <= 0) {
    return { status: 'no-cost' }
  }
  const floor = input.config.multiplier.floor
  const target = Number.isFinite(targetTotal) ? targetTotal : 0
  const exact = (target - quote.uncostedPrice) / quote.totalCost
  const multiplier = Math.max(floor, exact)
  // Line prices round to whole dollars, so report what the quote actually adds up to at this multiplier.
  const achievedTotal = priceQuote({ ...input, overrides: { multiplier } }).totalPrice
  return { status: exact >= floor ? 'reached' : 'below-floor', multiplier, achievedTotal }
}
