'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'

/** The catalog trade on stage. Reads no selections, so it does not re-render callers on toggles. */
export function useStageTrade(): Trade | undefined {
  const { catalog } = useTradeCatalogContext()
  const { stageTradeId } = useTradeStage()
  return stageTradeId ? catalog.tradesById.get(stageTradeId) : undefined
}
