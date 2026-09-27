import type { TradeAccessor } from '@/shared/db/types/trades'

export const TRADE_KEYS = ['hvac', 'roof', 'windowsAndDoors', 'atticBasement', 'exteriorPaintSiding', 'dryscapingHardscaping'] as const satisfies readonly TradeAccessor[]

export type TradeKey = typeof TRADE_KEYS[number]

export const AGING_TRADE_KEYS = ['hvac', 'roof', 'windowsAndDoors', 'exteriorPaintSiding'] as const satisfies readonly TradeKey[]

export type AgingTradeKey = typeof AGING_TRADE_KEYS[number]

export type CutSource = TradeKey | 'ducts'

export const TRADE_LABELS = {
  hvac: 'HVAC',
  roof: 'Roof',
  windowsAndDoors: 'Windows & Doors',
  atticBasement: 'Attic & Basement',
  exteriorPaintSiding: 'Exterior Paint & Siding',
  dryscapingHardscaping: 'Dryscaping & Hardscaping',
} as const satisfies Record<TradeKey, string>

export const CUT_SOURCE_LABELS = {
  ...TRADE_LABELS,
  ducts: 'Ducts',
} as const satisfies Record<CutSource, string>

export const CURRENT_LABELS = {
  hvac: 'HVAC',
  roof: 'Roof',
  windowsAndDoors: 'Windows & doors',
  exteriorPaintSiding: 'Exterior paint',
} as const satisfies Record<AgingTradeKey, string>

export const CURRENT_SENTENCE_LABELS = {
  hvac: 'HVAC',
  roof: 'roof',
  windowsAndDoors: 'windows and doors',
  exteriorPaintSiding: 'exterior paint',
} as const satisfies Record<AgingTradeKey, string>

export const CURRENT_IS_PLURAL = {
  hvac: false,
  roof: false,
  windowsAndDoors: true,
  exteriorPaintSiding: false,
} as const satisfies Record<AgingTradeKey, boolean>

export function isAgingTrade(trade: TradeKey): trade is AgingTradeKey {
  return (AGING_TRADE_KEYS as readonly TradeKey[]).includes(trade)
}
