import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'

import { offersEfficiencyUpgrade } from '@/features/trade-scenes/lib/scope-chip-options'

// The store keeps the cool roof on with no covering picked, so it counts only while a pick can take it.
export function coolRoofOn(picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): boolean {
  return efficiencyUpgrades.includes('cool-roof') && offersEfficiencyUpgrade(picks, 'cool-roof')
}
