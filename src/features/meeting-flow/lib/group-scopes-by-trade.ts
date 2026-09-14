import type { TradeScopeGroup } from '@/features/meeting-flow/types'
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'

export function groupScopesByTrade(items: ScopeOrAddon[]): Map<string, TradeScopeGroup> {
  const groups = new Map<string, TradeScopeGroup>()
  for (const item of items) {
    const group = groups.get(item.relatedTrade) ?? { scopes: [], addons: [] }
    if (item.entryType === 'Addon') {
      group.addons.push(item)
    }
    else {
      group.scopes.push(item)
    }
    groups.set(item.relatedTrade, group)
  }
  return groups
}
