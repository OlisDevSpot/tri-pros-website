import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { SowFinancials } from '@/shared/modules/proposals/core/schemas'
import { computeSectionFinancials, computeTotalSectionIncentives, computeTotalSectionPrices } from '@/shared/modules/proposals/core/lib/financials'

type SowSection = ProposalFormSchema['project']['data']['sow'][number]

export interface SectionPriceDisplay {
  starting: number | null
  final: number | null
  struck: boolean
}

export function sectionPriceDisplay(financials: SowFinancials, mode: PriceDisplayMode): SectionPriceDisplay {
  if (mode !== 'breakdown') {
    return { starting: null, final: null, struck: false }
  }
  const { price, netPrice, hasIncentives } = computeSectionFinancials({ title: '', financials })
  if (price === null || price <= 0) {
    return { starting: price, final: null, struck: false }
  }
  return { starting: price, final: netPrice, struck: hasIncentives && price !== netPrice }
}

export function summarizeSowPrices(
  sow: SowSection[],
  mode: PriceDisplayMode,
): { count: number, starting: number | null, final: number | null, struck: boolean } {
  if (mode !== 'breakdown') {
    return { count: sow.length, starting: null, final: null, struck: false }
  }
  const starting = computeTotalSectionPrices(sow)
  const final = starting - computeTotalSectionIncentives(sow)
  return { count: sow.length, starting, final, struck: final !== starting }
}
