import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'

import { offersEfficiencyUpgrade } from '@/features/trade-scenes/lib/scope-chip-options'

// R-8 only steps up the ducts a pick lays, so it stays while any pick lays them and a later one starts at R-6; the cool roof and Cool Life paint are defaults and stay.
export function keepEfficiencyUpgrades(upgrades: readonly EfficiencyUpgradeId[], picks: readonly string[]): EfficiencyUpgradeId[] {
  return offersEfficiencyUpgrade(picks, 'r8-ducts') ? [...upgrades] : upgrades.filter(upgrade => upgrade !== 'r8-ducts')
}
