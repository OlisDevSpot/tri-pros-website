import type { Scope, Trade } from '@/shared/modules/construction/core/schemas'

/** A trade's catalog entries, split by `Scope.kind`. */
export interface TradeScopeGroup {
  scopes: Scope[]
  addons: Scope[]
}

export interface CatalogIndex {
  trades: Trade[]
  tradesById: ReadonlyMap<string, Trade>
  tradesBySlug: ReadonlyMap<string, Trade>
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
  /** Scopes and add-ons by id: the one scope → trade lookup (`scopesById.get(id)?.tradeId`). */
  scopesById: ReadonlyMap<string, Scope>
}

/**
 * The whole catalog, indexed once. Pure — used by both the client hook and
 * any RSC path, so neither re-derives these maps.
 */
export function buildCatalogIndex(trades: Trade[], scopes: Scope[]): CatalogIndex {
  const scopesByTrade = new Map<string, TradeScopeGroup>()
  const scopesById = new Map<string, Scope>()
  for (const scope of scopes) {
    const group = scopesByTrade.get(scope.tradeId) ?? { scopes: [], addons: [] }
    if (scope.kind === 'addon') {
      group.addons.push(scope)
    }
    else {
      group.scopes.push(scope)
    }
    scopesByTrade.set(scope.tradeId, group)
    scopesById.set(scope.id, scope)
  }

  return {
    trades,
    tradesById: new Map(trades.map(trade => [trade.id, trade])),
    tradesBySlug: new Map(trades.map(trade => [trade.slug, trade])),
    scopesByTrade,
    scopesById,
  }
}
