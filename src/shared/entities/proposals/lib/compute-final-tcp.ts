import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { computeSectionIncentives } from '@/shared/entities/proposals/lib/compute-sow-financials'

/**
 * Canonical TCP helpers —
 *   finalTcp = max(0, startingTcp − Σ global 'discount' incentives − Σ section incentives)
 * Section incentives reduce the customer's price (business ruling 2026-07-09,
 * spec Addendum A). Never persisted. see ../DOCS.md#final-tcp-derived
 */
export function computeTotalDiscounts(data: FundingSection['data']): number {
  return data.incentives.reduce((sum, inc) => {
    return inc.type === 'discount' ? sum + inc.amount : sum
  }, 0)
}

export function computeTotalSectionIncentives(sow: ProjectSection['data']['sow']): number {
  return sow.reduce((sum, section) => sum + computeSectionIncentives(section), 0)
}

export interface FinalTcpInputs {
  funding: FundingSection['data']
  sow: ProjectSection['data']['sow']
}

export function computeFinalTcp({ funding, sow }: FinalTcpInputs): number {
  return Math.max(
    0,
    funding.startingTcp - computeTotalDiscounts(funding) - computeTotalSectionIncentives(sow),
  )
}
