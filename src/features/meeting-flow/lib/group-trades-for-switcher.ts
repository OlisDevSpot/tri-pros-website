import type { SwitcherGroup } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/modules/construction/core/schemas'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { tradeCategories } from '@/shared/modules/construction/core/schemas'

/** "On your project" first (catalog order), then each category without the on-project trades. Empty groups are dropped. */
export function groupTradesForSwitcher(trades: Trade[], selections: TradeSelection[]): SwitcherGroup[] {
  const onProject = trades.filter(trade => isTradeSelected(selections, trade.id))
  const rest = trades.filter(trade => !isTradeSelected(selections, trade.id))
  const groups: SwitcherGroup[] = [
    { key: 'on-project', label: SPECIALTIES_COPY.work.onProject, trades: onProject },
    ...tradeCategories.map(category => ({
      key: category,
      label: TRADE_CATEGORY_LABELS[category],
      trades: rest.filter(trade => trade.category === category),
    })),
  ]
  return groups.filter(group => group.trades.length > 0)
}
