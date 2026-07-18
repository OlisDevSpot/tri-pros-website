import type { FundingSection, ProjectSection } from '@/shared/entities/proposals/types'
import { computeFinalTcp, computeTotalSectionIncentives } from './compute-price-side'

export interface BreakdownSectionLine {
  title: string
  /** Original (pre-incentive) section price. Only sections with price > 0 appear. */
  price: number
  incentives: { id: string, label: string, amount: number }[]
  /** price − Σ incentives */
  netPrice: number
}

export interface BreakdownGlobalLine {
  key: string
  kind: 'discount' | 'exclusive-offer' | 'section-discount'
  /** Resolved display label (fallbacks applied). */
  label: string
  /** Dollar amount; null for exclusive-offer lines (rendered as "Included"). */
  amount: number | null
  /** Raw notes — discounts: same text the label resolved from; offers: supplemental text. */
  notes?: string
  expiresAt?: string
}

export interface PricingBreakdownModel {
  pricingMode: 'total' | 'breakdown'
  /** Breakdown mode: priced sections with incentives resolved. Empty in total mode. */
  sections: BreakdownSectionLine[]
  /** Breakdown-mode misc price; null when absent or 0. */
  miscPrice: number | null
  /** startingTcp — the pre-discount contract price. */
  subtotal: number
  /** subtotal − Σ section incentives. */
  netSubtotal: number
  /** Global funding incentives (discounts + exclusive offers), in stored order. */
  globalLines: BreakdownGlobalLine[]
  /** Section incentives flattened into standalone discount lines. */
  sectionIncentiveLines: BreakdownGlobalLine[]
  finalTcp: number
  deposit: number
  cashInDeal: number
}

export interface PricingBreakdownInput {
  funding: FundingSection['data']
  sow: ProjectSection['data']['sow']
  pricingMode: 'total' | 'breakdown'
}

/** Computed ONCE; rendered by the React component, the PDF builder, and the summary route. */
export function buildPricingBreakdown({
  funding,
  sow,
  pricingMode,
}: PricingBreakdownInput): PricingBreakdownModel {
  const sections: BreakdownSectionLine[]
    = pricingMode === 'breakdown'
      ? sow
          .map((section, i) => ({ section, title: section.title || `Section ${i + 1}` }))
          .filter(({ section }) => (section.financials.sectionPrice ?? 0) > 0)
          .map(({ section, title }) => {
            const incentives = (section.financials.incentives ?? []).map(inc => ({
              id: inc.id,
              label: inc.label || 'Discount',
              amount: inc.amount,
            }))
            const price = section.financials.sectionPrice!
            const incentiveTotal = incentives.reduce((sum, inc) => sum + inc.amount, 0)
            return { title, price, incentives, netPrice: price - incentiveTotal }
          })
      : []

  const globalLines: BreakdownGlobalLine[] = funding.incentives.map((inc, i) =>
    inc.type === 'discount'
      ? {
          key: `discount-${i}`,
          kind: 'discount' as const,
          label: inc.notes || 'Discount',
          amount: inc.amount,
          notes: inc.notes,
          expiresAt: inc.expiresAt,
        }
      : {
          key: `offer-${i}`,
          kind: 'exclusive-offer' as const,
          label: inc.offer || 'Exclusive Offer',
          amount: null,
          notes: inc.notes,
          expiresAt: inc.expiresAt,
        },
  )

  const sectionIncentiveLines: BreakdownGlobalLine[] = sow.flatMap((section, i) =>
    (section.financials.incentives ?? []).map(inc => ({
      key: inc.id,
      kind: 'section-discount' as const,
      label: inc.label || `${section.title || `Section ${i + 1}`} discount`,
      amount: inc.amount,
    })),
  )

  const subtotal = funding.startingTcp
  return {
    pricingMode,
    sections,
    miscPrice: (funding.miscPrice ?? 0) > 0 ? funding.miscPrice! : null,
    subtotal,
    netSubtotal: subtotal - computeTotalSectionIncentives(sow),
    globalLines,
    sectionIncentiveLines,
    finalTcp: computeFinalTcp({ funding, sow }),
    deposit: funding.depositAmount,
    cashInDeal: funding.cashInDeal,
  }
}
