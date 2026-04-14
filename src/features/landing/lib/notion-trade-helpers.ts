import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { unstable_cache } from 'next/cache'

import { getTradeImages } from '@/features/landing/lib/get-trade-images'
import { constructionDataService } from '@/shared/services/construction-data.service'

export type PillarSlug = 'energy-efficient-construction' | 'luxury-renovations'

export type TradeWithScopes = Trade & {
  scopes: ScopeOrAddon[]
  images: string[]
}

const PILLAR_TYPE_MAP: Record<PillarSlug, string[]> = {
  'energy-efficient-construction': ['Energy Efficiency'],
  'luxury-renovations': ['General Construction', 'Structural / Functional'],
}

export const getCachedTrades = unstable_cache(
  async () => {
    return constructionDataService.getTrades()
  },
  ['notion-trades'],
  { tags: ['notion-trades'], revalidate: 180 },
)

export const getCachedScopes = unstable_cache(
  async () => {
    return constructionDataService.getAllScopes()
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

  // Fetch images per trade in parallel — each trade's scope IDs map to different projects
  const imagesByTradeId = new Map<string, string[]>()
  await Promise.all(
    pillarTrades.map(async (trade) => {
      const images = trade.relatedScopes.length > 0
        ? await getTradeImages(trade.relatedScopes)
        : []
      imagesByTradeId.set(trade.id, images)
    }),
  )

  return pillarTrades.map(trade => ({
    ...trade,
    scopes: scopesByTrade.get(trade.id) ?? [],
    images: imagesByTradeId.get(trade.id) ?? [],
  }))
}

export async function getTradeBySlug(
  pillarSlug: PillarSlug,
  tradeSlug: string,
): Promise<TradeWithScopes | null> {
  const trades = await getTradesByPillar(pillarSlug)
  return trades.find(t => t.slug === tradeSlug) ?? null
}
