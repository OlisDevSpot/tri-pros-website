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
 * `hasMissingCostData` flags asymmetric incompleteness — true when SOME
 * sections have cost lines and some don't (the agent started tracking
 * but didn't finish). False when no sections have cost lines (haven't
 * started) or all do (finished). Avoids alert fatigue in total-mode
 * proposals where cost lines are optional.
 */
export function computeProposalCostTotals(data: InsertProposalSchema): ProposalCostTotals {
  const finalTcp = computeFinalTcp(data.fundingJSON.data)

  const totalCost = data.projectJSON.data.sow.reduce(
    (sum, section) => sum + computeSectionCost(section),
    0,
  )

  const hasAnyCostLines = data.projectJSON.data.sow.some(
    section => section.financials.costLines.length > 0,
  )
  const hasAnyMissing = data.projectJSON.data.sow.some(
    section => section.financials.costLines.length === 0,
  )
  const hasMissingCostData = hasAnyCostLines && hasAnyMissing

  return {
    totalCost,
    totalMargin: finalTcp - totalCost,
    totalMultiplier: totalCost === 0 ? null : finalTcp / totalCost,
    hasMissingCostData,
  }
}
