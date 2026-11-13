import type { QuoteLineResult } from '@/features/calculators/scope-pricing-calculator/types'

// A priced custom scope has no cost; checking cost keeps its price field on the card while the agent edits it.
export function isCustomLine(result: QuoteLineResult | undefined): boolean {
  if (result == null || result.kind !== 'formula') {
    return false
  }
  return result.status === 'incomplete' ? result.reason === 'custom' : result.cost == null
}
