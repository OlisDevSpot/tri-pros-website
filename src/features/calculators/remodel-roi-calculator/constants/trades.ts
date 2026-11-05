import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { BILL_CUT_ADD_ON_LABELS } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'

export const TRADE_KEYS = ['hvac', 'roof-and-gutters', 'windows-and-doors', 'attic-and-basement', 'exterior-paint-stucco-and-siding', 'dryscaping'] as const satisfies readonly TradeSlug[]

export type TradeKey = typeof TRADE_KEYS[number]

export const AGING_TRADE_KEYS = ['hvac', 'roof-and-gutters', 'windows-and-doors', 'exterior-paint-stucco-and-siding'] as const satisfies readonly TradeKey[]

export type AgingTradeKey = typeof AGING_TRADE_KEYS[number]

export type CutSource = TradeKey | BillCutAddOnId

export const TRADE_LABELS = {
  'hvac': 'HVAC',
  'roof-and-gutters': 'Roof',
  'windows-and-doors': 'Windows & Doors',
  'attic-and-basement': 'Attic & Basement',
  'exterior-paint-stucco-and-siding': 'Exterior Paint & Siding',
  'dryscaping': 'Dryscaping & Hardscaping',
} as const satisfies Record<TradeKey, string>

export const CUT_SOURCE_LABELS = { ...TRADE_LABELS, ...BILL_CUT_ADD_ON_LABELS } as const satisfies Record<CutSource, string>

export const CURRENT_LABELS = {
  'hvac': 'HVAC',
  'roof-and-gutters': 'Roof',
  'windows-and-doors': 'Windows & doors',
  'exterior-paint-stucco-and-siding': 'Exterior paint',
} as const satisfies Record<AgingTradeKey, string>

export const CURRENT_SENTENCE_LABELS = {
  'hvac': 'HVAC',
  'roof-and-gutters': 'roof',
  'windows-and-doors': 'windows and doors',
  'exterior-paint-stucco-and-siding': 'exterior paint',
} as const satisfies Record<AgingTradeKey, string>

export const CURRENT_IS_PLURAL = {
  'hvac': false,
  'roof-and-gutters': false,
  'windows-and-doors': true,
  'exterior-paint-stucco-and-siding': false,
} as const satisfies Record<AgingTradeKey, boolean>

export function isAgingTrade(trade: TradeKey): trade is AgingTradeKey {
  return (AGING_TRADE_KEYS as readonly TradeKey[]).includes(trade)
}

// "Near the end of its life" is a claim about the current one's age, so it holds only when it gives out within a few years, whatever look-ahead is picked.
export const NEAR_END_OF_LIFE_YEARS = 5
