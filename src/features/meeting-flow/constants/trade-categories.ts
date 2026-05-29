export const TRADE_CATEGORY_ORDER = [
  'Energy Efficiency',
  'General Construction',
  'Structural / Rough',
] as const

export type TradeCategory = (typeof TRADE_CATEGORY_ORDER)[number]

export const TRADE_CATEGORY_LABELS: Record<TradeCategory, string> = {
  'Energy Efficiency': 'Energy Efficiency',
  'General Construction': 'General Construction',
  'Structural / Rough': 'Structural & Rough',
}
