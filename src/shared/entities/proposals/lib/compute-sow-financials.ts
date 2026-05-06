import type { z } from 'zod'
import type { sowFinancialsSchema } from '@/shared/entities/proposals/schemas'

type SowFinancials = z.infer<typeof sowFinancialsSchema>
interface SectionLike {
  financials: SowFinancials
}

/**
 * Σ of all cost-line amounts in this section. Returns 0 when there are
 * no cost lines. Accepts any object with a `financials` field so callers
 * can pass either a full SowSection or a synthetic minimal projection
 * (used by the form to avoid over-watching the SOW subtree).
 */
export function computeSectionCost(section: SectionLike): number {
  return section.financials.costLines.reduce((sum, line) => sum + line.amount, 0)
}

/**
 * `sectionPrice − totalCost`. Returns null when there is no
 * `sectionPrice` (total-mode sections) or when there are no cost lines
 * (cost is unknown rather than zero).
 */
export function computeSectionMargin(section: SectionLike): number | null {
  const price = section.financials.sectionPrice
  if (price == null) {
    return null
  }
  if (section.financials.costLines.length === 0) {
    return null
  }
  return price - computeSectionCost(section)
}

/**
 * `sectionPrice ÷ totalCost`. Returns null when sectionPrice is null,
 * cost is 0, or there are no cost lines. Caller formats display.
 */
export function computeSectionMultiplier(section: SectionLike): number | null {
  const price = section.financials.sectionPrice
  if (price == null) {
    return null
  }
  const cost = computeSectionCost(section)
  if (cost === 0) {
    return null
  }
  return price / cost
}

/**
 * Format a multiplier for display: 2 decimals, "x" suffix, "—" for null.
 * Used by the agent-only Internal Calculation block.
 */
export function formatMultiplier(value: number | null): string {
  if (value == null) {
    return '—'
  }
  return `${value.toFixed(2)}x`
}
