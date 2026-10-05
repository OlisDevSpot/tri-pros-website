import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { Scope, Trade } from '@/shared/modules/construction/core/schemas'

export interface ResolvedCatalogIds<T> {
  found: T[]
  orphans: string[]
}

function resolveIds<T>(ids: readonly string[], byId: ReadonlyMap<string, T>): ResolvedCatalogIds<T> {
  const found: T[] = []
  const orphans: string[] = []
  for (const id of ids) {
    const entry = byId.get(id)
    if (entry) {
      found.push(entry)
    }
    else {
      orphans.push(id)
    }
  }
  return { found, orphans }
}

/** Stored ids to catalog entries, in stored order. An id the catalog no longer has comes back as an orphan; what an orphan means is the caller's call. */
export function resolveTrades(ids: readonly string[], index: Pick<CatalogIndex, 'tradesById'>): ResolvedCatalogIds<Trade> {
  return resolveIds(ids, index.tradesById)
}

export function resolveScopes(ids: readonly string[], index: Pick<CatalogIndex, 'scopesById'>): ResolvedCatalogIds<Scope> {
  return resolveIds(ids, index.scopesById)
}
