import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import { selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'

/** Only catalog trades can be on stage: the showcase needs the trade's slug, category and scopes. */
export function resolveStageTradeId(urlTradeId: string | null, selections: TradeSelection[], catalog: Pick<CatalogIndex, 'trades' | 'tradesById'>): string | null {
  if (urlTradeId && catalog.tradesById.has(urlTradeId)) {
    return urlTradeId
  }
  const firstOnProject = selectedTradeSelections(selections).find(entry => catalog.tradesById.has(entry.tradeId))
  return firstOnProject?.tradeId ?? catalog.trades[0]?.id ?? null
}
