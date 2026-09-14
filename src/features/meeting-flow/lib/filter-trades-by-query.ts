import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'

export function filterTradesByQuery(trades: Trade[], query: string): Trade[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return trades
  }
  return trades.filter(trade => trade.name.toLowerCase().includes(needle))
}
