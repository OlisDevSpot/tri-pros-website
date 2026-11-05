import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { HomeFacts } from '@/shared/modules/construction/core/types'

import { existingParts } from '@/features/trade-scenes/lib/part-offers'
import { requiredUpgrade } from '@/features/trade-scenes/lib/required-upgrade'
import { offersEfficiencyUpgrade } from '@/features/trade-scenes/lib/scope-chip-options'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'

type PickOptions = Pick<TradeSceneInputs, 'efficiencyUpgrades' | 'installStyles'>

// Every upgrade the picks cannot go without, each read against the existing part.
export function requiredUpgrades(picks: readonly string[], facts: HomeFacts): EfficiencyUpgradeId[] {
  const required = picks.flatMap((pick) => {
    const entry = SCOPE_INSTALLS[pick]
    if (!entry) {
      return []
    }
    const existing = existingParts(entry.assembly, facts)
    return entry.installs.flatMap((install) => {
      const part = ASSEMBLIES[entry.assembly].parts.find(candidate => candidate.id === install.part)!
      const upgrade = requiredUpgrade(pick, part, existing.find(candidate => candidate.id === part.id)?.material ?? null)
      return upgrade === null || upgrade === 'not-offered' ? [] : [upgrade]
    })
  })
  return [...new Set(required)]
}

// Run after every scene change, so whatever the change was, a required upgrade is on and an option no pick can take goes.
// R-38 only steps up an insulation pick, so it goes with the pick and a later one starts at R-30.
export function keepPickOptions(state: TradeSceneInputs, year: number): PickOptions {
  const picks = state.proposedScopeIds
  const facts = { property: state.property, materials: state.homeMaterials, year }
  const required = requiredUpgrades(picks, facts).filter(upgrade => !state.efficiencyUpgrades.includes(upgrade))
  const efficiencyUpgrades = [...state.efficiencyUpgrades, ...required].filter(upgrade => upgrade !== 'r38-insulation' || offersEfficiencyUpgrade(picks, upgrade))
  const installStyles = state.installStyles.filter(style => picks.some(pick => SCOPE_INSTALLS[pick]?.installs.some(install => install.styles?.[style] !== undefined)))
  return { efficiencyUpgrades, installStyles }
}
