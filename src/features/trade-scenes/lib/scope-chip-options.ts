import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { upgradeScope } from '@/features/trade-scenes/lib/upgrade-scopes'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { UPGRADE_SCOPES } from '@/shared/modules/construction/core/constants/upgrade-scopes'

// Only a covering with a version for the upgrade can take it; a tile reset installs a covering but has none. An upgrade
// that is a pair of scopes is offered by its members, and not when the home already has the upgraded material, since
// the repaint then uses it whatever the switch says and the switch would do nothing.
export function offersEfficiencyUpgrade(scopeIds: readonly string[], upgrade: EfficiencyUpgradeId, existingMaterial?: string | null): boolean {
  if (upgrade in UPGRADE_SCOPES) {
    const scopes = UPGRADE_SCOPES[upgrade as keyof typeof UPGRADE_SCOPES]
    const held = scopeIds.some(scopeId => scopeId === scopes.plain || scopeId === scopes.upgraded)
    return held && (existingMaterial === undefined || upgradeScope(upgrade as keyof typeof UPGRADE_SCOPES, [], existingMaterial) !== scopes.upgraded)
  }
  return scopeIds.some(scopeId => SCOPE_INSTALLS[scopeId]?.installs.some(install => install.swapsWith?.[upgrade] !== undefined) ?? false)
}

export function tradeFallbackLabel(trade: TradeSlug): string {
  const words = trade.replaceAll('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
