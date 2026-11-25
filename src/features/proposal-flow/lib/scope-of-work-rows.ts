import type { SectionPriceDisplay } from './section-price'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { computeSectionFinancials } from '@/shared/modules/proposals/core/lib/financials'
import { formatLedgerAmount } from './format-ledger-amount'
import { sectionPriceDisplay } from './section-price'

type SowSection = ProposalFormSchema['project']['data']['sow'][number]

export interface ScopeOfWorkRow {
  title: string
  price: SectionPriceDisplay
  incentives: string | null
}

export function scopeOfWorkRows(sow: SowSection[], mode: PriceDisplayMode): ScopeOfWorkRow[] {
  return sow.map((section) => {
    const { incentives } = computeSectionFinancials(section)
    return {
      title: section.title.trim() || section.trade.label.trim() || 'Untitled part',
      price: sectionPriceDisplay(section.financials, mode),
      incentives: incentives > 0 ? `${formatLedgerAmount(0 - incentives)} section incentives` : null,
    }
  })
}
