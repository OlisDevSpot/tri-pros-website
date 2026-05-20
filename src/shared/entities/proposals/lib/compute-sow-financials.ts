import type { SowFinancials } from '@/shared/entities/proposals/schemas'

interface SectionLike {
  financials: SowFinancials
}

// — Safe accessors (single source of null-safety for legacy JSONB) ——————————

function costLines(section: SectionLike) {
  return section.financials.costLines ?? []
}

function incentives(section: SectionLike) {
  return section.financials.incentives ?? []
}

// — Predicates ——————————————————————————————————————————————————————————————

export function hasCostLines(section: SectionLike): boolean {
  return costLines(section).length > 0
}

export function hasIncentives(section: SectionLike): boolean {
  return incentives(section).length > 0
}

// — Compute helpers —————————————————————————————————————————————————————————

export function computeSectionCost(section: SectionLike): number {
  return costLines(section).reduce((sum, line) => sum + line.amount, 0)
}

export function computeSectionIncentives(section: SectionLike): number {
  return incentives(section).reduce((sum, inc) => sum + inc.amount, 0)
}

/** Price − Cost − Incentives. Null when sectionPrice is null (total-mode) or no cost lines. */
export function computeSectionMargin(section: SectionLike): number | null {
  const price = section.financials.sectionPrice
  if (price == null) {
    return null
  }
  if (!hasCostLines(section)) {
    return null
  }
  return price - computeSectionCost(section) - computeSectionIncentives(section)
}

/** Price ÷ Cost. Null when sectionPrice is null, cost is 0, or no cost lines. */
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

export function formatMultiplier(value: number | null): string {
  if (value == null) {
    return '—'
  }
  return `${value.toFixed(2)}x`
}

// — Multiplier tier (drives color in UI) ——————————————————————————————————

export type MultiplierTier = 'danger' | 'healthy' | 'excellent' | 'unknown'

/** see ../DOCS.md#margin-multiplier-tiers */
export function getMultiplierTier(value: number | null): MultiplierTier {
  if (value == null) {
    return 'unknown'
  }
  if (value < 2) {
    return 'danger'
  }
  if (value >= 3) {
    return 'excellent'
  }
  return 'healthy'
}
