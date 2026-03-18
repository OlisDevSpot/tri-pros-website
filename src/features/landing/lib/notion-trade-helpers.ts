import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { unstable_cache } from 'next/cache'

import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToScope } from '@/shared/services/notion/lib/scopes/adapter'
import { pageToTrade } from '@/shared/services/notion/lib/trades/adapter'

export type PillarSlug = 'energy-efficient-construction' | 'luxury-renovations'

export type TradeWithScopes = Trade & {
  scopes: ScopeOrAddon[]
}

const PILLAR_TYPE_MAP: Record<PillarSlug, string[]> = {
  'energy-efficient-construction': ['Energy Efficiency'],
  'luxury-renovations': ['General Construction', 'Structural / Functional'],
}

export const getCachedTrades = unstable_cache(
  async () => {
    const raw = await queryNotionDatabase('trades', {
      sortBy: { property: 'name', direction: 'ascending' },
    })
    return raw ? raw.map(pageToTrade) : []
  },
  ['notion-trades'],
  { tags: ['notion-trades'], revalidate: 180 },
)

export const getCachedScopes = unstable_cache(
  async () => {
    const raw = await queryNotionDatabase('scopes')
    return raw ? raw.map(pageToScope) : []
  },
  ['notion-scopes'],
  { tags: ['notion-scopes'], revalidate: 180 },
)

export async function getTradesByPillar(pillarSlug: PillarSlug): Promise<TradeWithScopes[]> {
  const [allTrades, allScopes] = await Promise.all([getCachedTrades(), getCachedScopes()])

  const allowedTypes = PILLAR_TYPE_MAP[pillarSlug]
  const pillarTrades = allTrades.filter(t => t.type && allowedTypes.includes(t.type))

  const scopesByTrade = new Map<string, ScopeOrAddon[]>()
  for (const scope of allScopes) {
    const existing = scopesByTrade.get(scope.relatedTrade) ?? []
    existing.push(scope)
    scopesByTrade.set(scope.relatedTrade, existing)
  }

  return pillarTrades.map(trade => ({
    ...trade,
    scopes: scopesByTrade.get(trade.id) ?? [],
  }))
}

export async function getTradeBySlug(
  pillarSlug: PillarSlug,
  tradeSlug: string,
): Promise<TradeWithScopes | null> {
  const trades = await getTradesByPillar(pillarSlug)
  return trades.find(t => t.slug === tradeSlug) ?? null
}
