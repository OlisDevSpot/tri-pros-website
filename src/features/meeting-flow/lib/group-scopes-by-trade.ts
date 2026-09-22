import type { TradeScopeGroup } from '@/features/meeting-flow/types'
import type { Scope } from '@/shared/modules/construction/core/schemas'

export function groupScopesByTrade(items: Scope[]): Map<string, TradeScopeGroup> {
  const groups = new Map<string, TradeScopeGroup>()
  for (const item of items) {
    const group = groups.get(item.tradeId) ?? { scopes: [], addons: [] }
    if (item.kind === 'addon') {
      group.addons.push(item)
    }
    else {
      group.scopes.push(item)
    }
    groups.set(item.tradeId, group)
  }
  return groups
}
