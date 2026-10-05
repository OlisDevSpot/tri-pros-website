import type { Trade } from '@/shared/modules/construction/core/schemas'

/** Requested trade ids from the lead, in order, deduplicated, limited to trades the catalog has. */
export function deriveLeadTrades(
  requested: ReadonlyArray<{ tradeId: string }> | null | undefined,
  tradesById: ReadonlyMap<string, Trade>,
): Trade[] {
  const seen = new Set<string>()
  const result: Trade[] = []
  for (const { tradeId } of requested ?? []) {
    const trade = tradesById.get(tradeId)
    if (trade && !seen.has(tradeId)) {
      seen.add(tradeId)
      result.push(trade)
    }
  }
  return result
}
