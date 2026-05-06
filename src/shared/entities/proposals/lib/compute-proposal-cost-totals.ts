import type { InsertProposalSchema } from '@/shared/db/schema'
import { computeFinalTcp } from './compute-final-tcp'
import { computeSectionCost } from './compute-sow-financials'

export interface ProposalCostTotals {
  totalCost: number
  totalMargin: number
  totalMultiplier: number | null
  hasMissingCostData: boolean
}

/**
 * Aggregate cost + margin + multiplier for a proposal, evaluated against
 * `finalTcp` (post-discount). Margin and multiplier are the agent's
 * headline KPIs for "profit per project" — discounts come out of agent
 * profit, so they must be netted in.
 *
 * `totalMultiplier` is null when total cost is 0 (avoids Infinity / NaN).
 * `hasMissingCostData` flags the case where any SOW section has zero
 * cost lines, so the UI can warn that totals are partial.
 */
export function computeProposalCostTotals(data: InsertProposalSchema): ProposalCostTotals {
  const finalTcp = computeFinalTcp(data.fundingJSON.data)

  const totalCost = data.projectJSON.data.sow.reduce(
    (sum, section) => sum + computeSectionCost(section),
    0,
  )

  const hasMissingCostData = data.projectJSON.data.sow.some(
    section => section.financials.costLines.length === 0,
  )

  return {
    totalCost,
    totalMargin: finalTcp - totalCost,
    totalMultiplier: totalCost === 0 ? null : finalTcp / totalCost,
    hasMissingCostData,
  }
}
