import type { HomeSystemId } from '@/features/trade-scenes/types'
import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { tradeSlugs } from '@/shared/modules/construction/core/constants/trade-slugs'

// The system a trade's work lands in; the other trades build nothing the scene draws as one of its six systems.
const SYSTEM_OF_TRADE: Partial<Record<TradeSlug, HomeSystemId>> = {
  'roof-and-gutters': 'roof',
  'attic-and-basement': 'attic',
  'windows-and-doors': 'windows',
  'exterior-paint-stucco-and-siding': 'walls',
  'hvac': 'heating-cooling',
  'foundation-and-crawl-space': 'foundation',
}

export const TRADE_SYSTEM = Object.fromEntries(tradeSlugs.map(trade => [trade, SYSTEM_OF_TRADE[trade] ?? null])) as Record<TradeSlug, HomeSystemId | null>

// An add-on's cut belongs to the system of the part that carries it, whichever trade's pick brings it.
export const ADD_ON_SYSTEM: Record<BillCutAddOnId, HomeSystemId> = {
  'ducts': 'heating-cooling',
  'radiant-barrier': 'attic',
  'attic-fan': 'attic',
  'insulation-step-up': 'attic',
}
