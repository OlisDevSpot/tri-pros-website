import type { PricingBreakdownModel } from './compute-breakdown'
import type { SectionFinancials } from './compute-section'
import type { MultiplierTier } from './tiers'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { buildPricingBreakdown } from './compute-breakdown'
import { computeFinalTcp, computeTotalDiscounts, computeTotalSectionIncentives } from './compute-price-side'
import { computeSectionFinancials } from './compute-section'
import { getMultiplierTier } from './tiers'

export interface ProposalFinancialsInput {
  funding: FundingSection['data']
  sow: ProjectSection['data']['sow']
  priceDisplayMode: PriceDisplayMode
}

export interface ProposalFinancials {
  // price side — what the customer pays
  /** startingTcp */
  subtotal: number
  totalSectionIncentives: number
  totalGlobalDiscounts: number
  /** section + global */
  totalIncentives: number
  /** max(0, subtotal − totalIncentives) */
  finalTcp: number
  // cost side — what we pay
  totalJobCosts: number
  // outputs
  /** finalTcp − totalJobCosts */
  margin: number
  /** finalTcp ÷ totalJobCosts; null when totalJobCosts is 0 */
  multiplier: number | null
  tier: MultiplierTier
  /** True only when SOME sections have cost lines and some don't. see ../../DOCS.md#cost-data-asymmetric-incomplete */
  hasMissingCostData: boolean
  /** Per-section financials, titles fallback-resolved ("Section N"). */
  sections: SectionFinancials[]
  /** Customer-safe pricing breakdown view-model. */
  breakdown: PricingBreakdownModel
}

/**
 * The one big call — every derived proposal financial value, computed at
 * once from the hydrated domain shape. Pure, cheap, never persisted.
 * see ../../DOCS.md#price-side-vs-cost-side
 */
export function computeProposalFinancials(input: ProposalFinancialsInput): ProposalFinancials {
  const { funding, sow } = input

  const sections = sow.map((section, i) =>
    computeSectionFinancials({ title: section.title || `Section ${i + 1}`, financials: section.financials }),
  )

  const subtotal = funding.startingTcp
  const totalSectionIncentives = computeTotalSectionIncentives(sow)
  const totalGlobalDiscounts = computeTotalDiscounts(funding)
  const totalIncentives = totalSectionIncentives + totalGlobalDiscounts
  const finalTcp = computeFinalTcp({ funding, sow })
  const totalJobCosts = sections.reduce((sum, s) => sum + s.jobCost, 0)
  const multiplier = totalJobCosts === 0 ? null : finalTcp / totalJobCosts

  const hasAnyCostLines = sections.some(s => s.hasCostLines)
  const hasAnyMissing = sections.some(s => !s.hasCostLines)

  return {
    subtotal,
    totalSectionIncentives,
    totalGlobalDiscounts,
    totalIncentives,
    finalTcp,
    totalJobCosts,
    margin: finalTcp - totalJobCosts,
    multiplier,
    tier: getMultiplierTier(multiplier),
    hasMissingCostData: hasAnyCostLines && hasAnyMissing,
    sections,
    breakdown: buildPricingBreakdown(input),
  }
}
