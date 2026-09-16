import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import type { SwitcherGroup } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_CATEGORY_LABELS, TRADE_CATEGORY_ORDER } from '@/features/meeting-flow/constants/trade-categories'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'

/** "On your project" first (catalog order), then each category without the on-project trades. Empty groups are dropped. */
export function groupTradesForSwitcher(trades: Trade[], selections: TradeSelection[]): SwitcherGroup[] {
  const onProject = trades.filter(trade => isTradeSelected(selections, trade.id))
  const rest = trades.filter(trade => !isTradeSelected(selections, trade.id))
  const groups: SwitcherGroup[] = [
    { key: 'on-project', label: SPECIALTIES_COPY.work.onProject, trades: onProject },
    ...TRADE_CATEGORY_ORDER.map(category => ({
      key: category,
      label: TRADE_CATEGORY_LABELS[category as TradeCategory],
      trades: rest.filter(trade => trade.type === category),
    })),
  ]
  return groups.filter(group => group.trades.length > 0)
}
