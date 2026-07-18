import type { MultiplierTier } from './tiers'
import type { SowFinancials } from '@/shared/entities/proposals/schemas'
import { getMultiplierTier } from './tiers'

export interface SectionFinancialsInput {
  title: string
  financials: SowFinancials
}

export interface SectionFinancials {
  title: string
  /** Raw sectionPrice (null in total pricing mode) */
  price: number | null
  /** Σ section incentive amounts */
  incentives: number
  /** price − incentives — what the customer pays for this section */
  netPrice: number | null
  /** Σ cost-line amounts — what we pay */
  jobCost: number
  /** netPrice − jobCost. Null when price is null or no cost lines. */
  margin: number | null
  /** netPrice ÷ jobCost. Null when price is null, no cost lines, or jobCost is 0. */
  multiplier: number | null
  tier: MultiplierTier
  hasCostLines: boolean
  hasIncentives: boolean
}

/**
 * Section-level financials. Same ruling as the proposal level: incentives
 * reduce the section's price, never its cost. Null (not 0) means "no
 * signal" — see ../../DOCS.md#margin-multiplier-tiers
 */
export function computeSectionFinancials({ title, financials }: SectionFinancialsInput): SectionFinancials {
  const costLines = financials.costLines ?? []
  const sectionIncentives = financials.incentives ?? []

  const price = financials.sectionPrice
  const incentives = sectionIncentives.reduce((sum, inc) => sum + inc.amount, 0)
  const jobCost = costLines.reduce((sum, line) => sum + line.amount, 0)
  const hasCostLines = costLines.length > 0

  const netPrice = price == null ? null : price - incentives
  const margin = netPrice == null || !hasCostLines ? null : netPrice - jobCost
  const multiplier = netPrice == null || !hasCostLines || jobCost === 0 ? null : netPrice / jobCost

  return {
    title,
    price,
    incentives,
    netPrice,
    jobCost,
    margin,
    multiplier,
    tier: getMultiplierTier(multiplier),
    hasCostLines,
    hasIncentives: sectionIncentives.length > 0,
  }
}
