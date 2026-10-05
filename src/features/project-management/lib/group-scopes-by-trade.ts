import type { Scope } from '@/shared/modules/construction/core/schemas'

export interface TradeRow {
  tradeId: string
  scopeIds: string[]
}

export function groupScopesByTrade(
  selectedScopeIds: string[],
  allScopes: Scope[],
): TradeRow[] {
  if (selectedScopeIds.length === 0 || allScopes.length === 0) {
    return []
  }

  const selectedSet = new Set(selectedScopeIds)
  const byTrade = new Map<string, string[]>()

  for (const scope of allScopes) {
    if (!selectedSet.has(scope.id)) {
      continue
    }

    const tradeId = scope.tradeId
    if (!byTrade.has(tradeId)) {
      byTrade.set(tradeId, [])
    }
    byTrade.get(tradeId)!.push(scope.id)
  }

  return Array.from(byTrade.entries()).map(([tradeId, scopeIds]) => ({
    tradeId,
    scopeIds,
  }))
}
