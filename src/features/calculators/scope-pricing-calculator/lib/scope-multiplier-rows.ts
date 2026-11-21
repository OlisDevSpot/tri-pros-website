import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { PricedLine, QuoteLineInput, QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

export interface ScopeMultiplierRow {
  index: number
  id: string
  pricingKey: PricingKey
  override: number | null
  priced: PricedLine | null
}

// An overridden custom or incomplete scope keeps its row so the agent can still clear the override.
export function scopeMultiplierRows(quote: QuoteResult, lines: readonly QuoteLineInput[]): ScopeMultiplierRow[] {
  const rows: ScopeMultiplierRow[] = []
  lines.forEach((line, index) => {
    if (line.kind !== 'formula') {
      return
    }
    const result = quote.lines.find(quoteLine => quoteLine.id === line.id)
    const priced = result?.status === 'priced' && result.cost != null ? result : null
    const override = line.multiplierOverride ?? null
    if (priced != null || override != null) {
      rows.push({ index, id: line.id, pricingKey: line.pricingKey, override, priced })
    }
  })
  return rows
}
