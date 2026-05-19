import type { FundingSection } from '@/shared/entities/proposals/types'

/** Canonical TCP helpers — `finalTcp = max(0, startingTcp − Σ discounts)`.
 *  Never persisted. see ../DOCS.md#final-tcp-derived */
export function computeTotalDiscounts(data: FundingSection['data']): number {
  return data.incentives.reduce((sum, inc) => {
    return inc.type === 'discount' ? sum + inc.amount : sum
  }, 0)
}

export function computeFinalTcp(data: FundingSection['data']): number {
  return Math.max(0, data.startingTcp - computeTotalDiscounts(data))
}
