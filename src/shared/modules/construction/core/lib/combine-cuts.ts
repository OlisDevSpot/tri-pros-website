import type { BillCategory } from '@/shared/modules/construction/core/constants/bill-categories'
import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'
import type { TradeBillCuts } from '@/shared/modules/construction/core/schemas/bill-cuts'
import type { CutPart } from '@/shared/modules/construction/core/types'

interface Picks<T extends TradeSlug> {
  trades: readonly T[]
  addOns: readonly BillCutAddOnId[]
  // The trades whose add-ons count, when that is not the trades whose base cut counts.
  addOnTrades?: readonly T[]
}

// Each cut takes its share of what the previous ones left, so the combined cut can never pass 100%.
export function combineCuts<T extends TradeSlug>({ trades, addOns, addOnTrades = trades }: Picks<T>, category: BillCategory, cuts: TradeBillCuts): { parts: CutPart<T | BillCutAddOnId>[], combined: number } {
  const parts: CutPart<T | BillCutAddOnId>[] = trades.flatMap((trade) => {
    const percent = cuts[trade]?.base[category]
    return percent ? [{ source: trade, percent }] : []
  })
  for (const trade of addOnTrades) {
    for (const addOn of addOns) {
      const percent = cuts[trade]?.addOns?.[addOn]?.[category]
      if (percent) {
        parts.push({ source: addOn, percent })
      }
    }
  }
  const combined = 1 - parts.reduce((kept, part) => kept * (1 - part.percent / 100), 1)
  return { parts, combined }
}
