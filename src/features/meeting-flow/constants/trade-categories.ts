import type { TradeCategory } from '@/shared/modules/construction/core/schemas'

/** Display copy for the specialties trade switcher. The category list itself lives in the module — `tradeCategories` in `modules/construction/core/schemas`. */
export const TRADE_CATEGORY_LABELS: Record<TradeCategory, string> = {
  'Energy Efficiency': 'Energy Efficiency',
  'General Construction': 'General Construction',
  'Structural / Rough': 'Structural & Rough',
}
