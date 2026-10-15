import type { BreakdownSectionLine } from '@/shared/modules/proposals/core/lib/financials'
import type { SOW } from '@/shared/modules/proposals/core/types'

export interface TotalModePart {
  key: string
  title: string
  incentives: BreakdownSectionLine['incentives']
}

// Keys, titles and incentive labels follow buildPricingBreakdown's sections, so a part reads the same in either mode.
export function getTotalModeParts(sow: SOW[]): TotalModePart[] {
  return sow.map((section, i) => ({
    key: `${i}-${section.title || 'section'}`,
    title: section.title || `Section ${i + 1}`,
    incentives: (section.financials.incentives ?? []).map(inc => ({ id: inc.id, label: inc.label || 'Discount', amount: inc.amount })),
  }))
}
