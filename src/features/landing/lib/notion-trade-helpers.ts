import type { Scope, Trade, TradeCategory } from '@/shared/modules/construction/core/schemas'

import { getTradeImages } from '@/features/landing/lib/get-trade-images'
import { constructionService } from '@/shared/modules/construction/service'

export type PillarSlug = 'energy-efficient-construction' | 'luxury-renovations'

export type TradeWithScopes = Trade & {
  scopes: Scope[]
  images: string[]
}

const PILLAR_CATEGORY_MAP: Record<PillarSlug, TradeCategory[]> = {
  'energy-efficient-construction': ['Energy Efficiency'],
  'luxury-renovations': ['General Construction', 'Structural / Rough'],
}

export async function getTradesByPillar(pillarSlug: PillarSlug): Promise<TradeWithScopes[]> {
  const { trades: allTrades, scopes: allScopes } = await constructionService.getCatalog()

  const allowedTypes = PILLAR_CATEGORY_MAP[pillarSlug]
  const pillarTrades = allTrades.filter(t => t.category && allowedTypes.includes(t.category))

  const scopesByTrade = new Map<string, Scope[]>()
  for (const scope of allScopes) {
    const existing = scopesByTrade.get(scope.tradeId) ?? []
    existing.push(scope)
    scopesByTrade.set(scope.tradeId, existing)
  }

  // Fetch images per trade in parallel — each trade's scope IDs map to different projects
  const imagesByTradeId = new Map<string, string[]>()
  await Promise.all(
    pillarTrades.map(async (trade) => {
      const images = trade.scopeIds.length > 0
        ? await getTradeImages(trade.scopeIds)
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
