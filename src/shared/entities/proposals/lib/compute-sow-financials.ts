import type { z } from 'zod'
import type { sowShape } from '@/shared/entities/proposals/schemas'

type SowSection = z.infer<typeof sowShape>

/**
 * Σ of all cost-line amounts in this section. Returns 0 when there are
 * no cost lines.
 */
export function computeSectionCost(section: SowSection): number {
  return section.financials.costLines.reduce((sum, line) => sum + line.amount, 0)
}

/**
 * `sectionPrice − totalCost`. Returns null when there is no
 * `sectionPrice` (total-mode sections) or when there are no cost lines
 * (cost is unknown rather than zero).
 */
export function computeSectionMargin(section: SowSection): number | null {
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
export function computeSectionMultiplier(section: SowSection): number | null {
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
