import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'

// Only a covering with a version for the upgrade can take it; a tile reset installs a covering but has none.
export function offersEfficiencyUpgrade(scopeIds: readonly string[], upgrade: EfficiencyUpgradeId): boolean {
  return scopeIds.some(scopeId => SCOPE_INSTALLS[scopeId]?.installs.some(install => install.swapsWith?.[upgrade] !== undefined) ?? false)
}

export function tradeFallbackLabel(trade: TradeSlug): string {
  const words = trade.replaceAll('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
