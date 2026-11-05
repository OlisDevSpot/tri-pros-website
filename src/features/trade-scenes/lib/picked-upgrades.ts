import type { HomeSystemId } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { HomeFacts } from '@/shared/modules/construction/core/types'

import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'

// Each system's picked upgrades, in the order the Upgrades list shows its rows.
export function pickedUpgrades(facts: HomeFacts, picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): Record<HomeSystemId, ScopeId[]> {
  const picked = Object.fromEntries(HOME_SYSTEM_IDS.map(id => [id, [] as ScopeId[]])) as Record<HomeSystemId, ScopeId[]>
  for (const { id, rows } of upgradeRows(facts, picks, efficiencyUpgrades)) {
    for (const row of rows) {
      const { picked: scopeId } = upgradeRowState(row, picks, efficiencyUpgrades)
      if (scopeId !== null) {
        picked[id].push(scopeId)
      }
    }
  }
  return picked
}
