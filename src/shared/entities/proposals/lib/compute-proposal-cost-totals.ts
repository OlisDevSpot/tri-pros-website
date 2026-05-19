import type { InsertProposalSchema } from '@/shared/db/schema'
import { computeSectionCost, computeSectionIncentives, hasCostLines } from './compute-sow-financials'

export interface ProposalCostTotals {
  /** Σ job cost line amounts across all sections */
  totalJobCosts: number
  /** Σ section-level incentive amounts across all sections */
  totalSectionIncentives: number
  /** Σ global discount incentives from funding */
  totalGlobalIncentives: number
  /** totalSectionIncentives + totalGlobalIncentives */
  totalIncentives: number
  /** totalJobCosts + totalIncentives (all costs the business absorbs) */
  totalCosts: number
  /** startingTcp — the pre-discount contract price */
  subtotal: number
  totalMargin: number
  totalMultiplier: number | null
  hasMissingCostData: boolean
}

/**
 * Aggregate cost + margin + multiplier vs `finalTcp` (post-discount, so
 * discounts net out of agent profit). `totalMultiplier` is null when total
 * cost is 0 to avoid Infinity/NaN.
 * see ../DOCS.md#margin-multiplier-tiers + #cost-data-asymmetric-incomplete
 */
export function computeProposalCostTotals(data: InsertProposalSchema): ProposalCostTotals {
  const sow = data.projectJSON.data.sow
  const subtotal = data.fundingJSON.data.startingTcp

  const totalJobCosts = sow.reduce(
    (sum, section) => sum + computeSectionCost(section),
    0,
  )
  const totalSectionIncentives = sow.reduce(
    (sum, section) => sum + computeSectionIncentives(section),
    0,
  )
  const totalGlobalIncentives = data.fundingJSON.data.incentives.reduce(
    (sum, inc) => inc.type === 'discount' ? sum + inc.amount : sum,
    0,
  )
  const totalIncentives = totalSectionIncentives + totalGlobalIncentives
  const totalCosts = totalJobCosts + totalIncentives

  const hasAnyCostLines = sow.some(hasCostLines)
  const hasAnyMissing = sow.some(section => !hasCostLines(section))
  const hasMissingCostData = hasAnyCostLines && hasAnyMissing

  return {
    totalJobCosts,
    totalSectionIncentives,
    totalGlobalIncentives,
    totalIncentives,
    totalCosts,
    subtotal,
    totalMargin: subtotal - totalCosts,
    totalMultiplier: totalCosts === 0 ? null : subtotal / totalCosts,
    hasMissingCostData,
  }
}
