import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { TRADE_CATEGORY_ORDER } from '@/features/meeting-flow/constants/trade-categories'

const OTHER = 'Other'

/** Categories in `TRADE_CATEGORY_ORDER`, then `Other`; alphabetical inside each; empty categories and disabled trades dropped. */
export function groupTradesByCategory(trades: Trade[]): [string, Trade[]][] {
  const groups = new Map<string, Trade[]>()
  for (const category of TRADE_CATEGORY_ORDER) {
    groups.set(category, [])
  }
  groups.set(OTHER, [])
  for (const trade of trades) {
    if (trade.disabled) {
      continue
    }
    const bucket = groups.get(trade.type ?? OTHER) ?? groups.get(OTHER)!
    bucket.push(trade)
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name))
  }
  return Array.from(groups.entries()).filter(([, bucket]) => bucket.length > 0)
}
