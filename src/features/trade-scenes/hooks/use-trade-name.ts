'use client'

import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { useCallback } from 'react'

import { tradeFallbackLabel } from '@/features/trade-scenes/lib/scope-chip-options'
import { useConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'

// The catalog may still be loading, or unreachable offline, so a trade falls back to a name made from its slug.
export function useTradeName(): (trade: TradeSlug) => string {
  const { tradesBySlug } = useConstructionCatalog()
  return useCallback((trade: TradeSlug) => tradesBySlug.get(trade)?.name ?? tradeFallbackLabel(trade), [tradesBySlug])
}
