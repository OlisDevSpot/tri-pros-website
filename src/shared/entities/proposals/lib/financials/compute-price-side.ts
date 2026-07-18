import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'

/**
 * Price side of the proposal financial model — what the customer pays.
 *   finalTcp = max(0, startingTcp − Σ global 'discount' incentives − Σ ALL section incentives)
 * Incentives and discounts reduce the PRICE; they are never a cost we absorb.
 * Never persisted (Stage-1 draft math per ADR-0005 Addendum A); the Stage-2
 * rollup lives in `proposals.final_tcp_cents`. see ../../DOCS.md#final-tcp-derived
 */
export function computeTotalDiscounts(data: FundingSection['data']): number {
  return data.incentives.reduce((sum, inc) => {
    return inc.type === 'discount' ? sum + inc.amount : sum
  }, 0)
}

export function computeTotalSectionIncentives(sow: ProjectSection['data']['sow']): number {
  return sow.reduce(
    (sum, section) => sum + (section.financials.incentives ?? []).reduce((s, inc) => s + inc.amount, 0),
    0,
  )
}

/** Σ sectionPrice across sections (breakdown pricing mode's subtotal input). */
export function computeTotalSectionPrices(sow: ProjectSection['data']['sow']): number {
  return sow.reduce((sum, section) => sum + (section.financials.sectionPrice ?? 0), 0)
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
