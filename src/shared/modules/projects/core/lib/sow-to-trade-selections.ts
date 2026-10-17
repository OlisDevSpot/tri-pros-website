import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { SOW } from '@/shared/modules/proposals/core/types'

/** A proposal's parts as the selections the portfolio matcher reads. */
export function sowToTradeSelections(sow: SOW[]): TradeSelection[] {
  return sow
    .filter(section => section.trade.id)
    .map(section => ({ tradeId: section.trade.id, tradeName: section.trade.label, selectedScopes: section.scopes, painPoints: [] }))
}
