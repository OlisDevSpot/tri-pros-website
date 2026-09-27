import type { TradeSelection } from '@/shared/entities/meetings/schemas'

import { TRADE_SELECTION_COPY } from '@/shared/entities/meetings/constants/trade-selection-copy'

export function formatWorkSummary(entry: TradeSelection): string {
  const [first, ...rest] = entry.selectedScopes
  if (!first) {
    return TRADE_SELECTION_COPY.noWork
  }
  return rest.length > 0 ? TRADE_SELECTION_COPY.workSummary(first.label, rest.length) : first.label
}
