import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

// The team's working numbers, not yet sourced: what the current install costs in repairs and upkeep each year
// until it is replaced. $0 where the team has no figure yet.
export const REPAIRS_PER_YEAR = {
  'hvac': 600,
  'roof-and-gutters': 400,
  'windows-and-doors': 200,
  'exterior-paint-stucco-and-siding': 150,
  'attic-and-basement': 0,
  'dryscaping': 0,
  'foundation-and-crawl-space': 0,
} as const satisfies Partial<Record<TradeSlug, number>>

// The share of the Worn figure a home material costs to keep up at each wear.
export const REPAIRS_SHARE_BY_WEAR = { new: 0, good: 0.4, fair: 0.7, worn: 1, failing: 1.5 } satisfies Record<Wear, number>
