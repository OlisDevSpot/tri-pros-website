import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

// R-8 only steps up a ducts pick, so it goes with the pick and a later one starts at R-6; the cool roof is the default and stays.
export function keepEfficiencyUpgrades(upgrades: readonly EfficiencyUpgradeId[], picks: readonly string[]): EfficiencyUpgradeId[] {
  return picks.includes(SCOPE_IDS.airDuctsReplacement) ? [...upgrades] : upgrades.filter(upgrade => upgrade !== 'r8-ducts')
}
