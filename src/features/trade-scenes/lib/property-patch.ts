import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { PropertyProfile } from '@/shared/modules/construction/core/types'

import { keepEfficiencyUpgrades } from '@/features/trade-scenes/lib/keep-efficiency-upgrades'
import { keepOffered } from '@/features/trade-scenes/lib/part-offers'
import { withUpgradeScopes } from '@/features/trade-scenes/lib/upgrade-scopes'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'

type PatchState = Pick<TradeSceneInputs, 'property' | 'homeMaterials' | 'proposedScopeIds' | 'efficiencyUpgrades'>

// Any home fact can change what is offered (a wall unit takes the ducts, a new roof takes the covering), so the picks are trimmed on every write.
// A material whose option the write itself changes is a new part, so wear recorded for the old one goes with it; an era guess moving the option leaves the rep's wear alone.
export function propertyPatch(state: PatchState, patch: Partial<PropertyProfile>, year: number): PatchState {
  const property = { ...state.property, ...patch }
  const before = resolveHomeMaterials({ property: state.property, materials: state.homeMaterials, year })
  const after = resolveHomeMaterials({ property, materials: state.homeMaterials, year })
  const wear = { ...state.homeMaterials.wear }
  for (const id of HOME_MATERIAL_IDS) {
    const field = HOME_MATERIALS[id].replaceable
    if ((field === 'insulationLevel' || field === 'windowsType') && field in patch && before[id]?.option !== after[id]?.option) {
      delete wear[id]
    }
  }
  const homeMaterials = { ...state.homeMaterials, wear }
  const facts = { property, materials: homeMaterials, year }
  const proposedScopeIds = keepOffered(withUpgradeScopes(state.proposedScopeIds, state.efficiencyUpgrades, facts), facts, state.efficiencyUpgrades)
  return { property, homeMaterials, proposedScopeIds, efficiencyUpgrades: keepEfficiencyUpgrades(state.efficiencyUpgrades, proposedScopeIds) }
}
