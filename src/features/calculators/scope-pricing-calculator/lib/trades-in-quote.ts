import type { PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

export function tradesInQuote(quote: QuoteResult): PricingTrade[] {
  return [...new Set(quote.lines.flatMap(line => (line.kind === 'formula' && line.trade != null ? [line.trade] : [])))]
}
