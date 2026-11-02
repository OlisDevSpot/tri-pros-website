import type { SceneChange, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { HomeMaterialFacts, PropertyProfile, ReplaceableField } from '@/shared/modules/construction/core/types'

import { keepEfficiencyUpgrades } from '@/features/trade-scenes/lib/keep-efficiency-upgrades'
import { keepOffered } from '@/features/trade-scenes/lib/part-offers'
import { propertyPatch } from '@/features/trade-scenes/lib/property-patch'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'

type PatchState = Pick<TradeSceneInputs, 'property' | 'homeMaterials' | 'proposedScopeIds' | 'efficiencyUpgrades'>

// These two options live on the property profile; the others are recorded beside the wear.
function isPropertyField(field: ReplaceableField): field is 'insulationLevel' | 'windowsType' {
  return field === 'insulationLevel' || field === 'windowsType'
}

function withoutWear(materials: HomeMaterialFacts, id: HomeMaterialId): HomeMaterialFacts {
  const { [id]: _dropped, ...wear } = materials.wear
  return { ...materials, wear }
}

// The picks are trimmed against the facts the write leaves, in the same write, so a New material never keeps a pick it can no longer take.
function settled(state: PatchState, property: PropertyProfile, materials: HomeMaterialFacts, year: number): Partial<TradeSceneInputs> {
  const proposedScopeIds = keepOffered(state.proposedScopeIds, { property, materials, year })
  return { property, homeMaterials: materials, proposedScopeIds, efficiencyUpgrades: keepEfficiencyUpgrades(state.efficiencyUpgrades, proposedScopeIds) }
}

function writeOption(state: PatchState, field: ReplaceableField, value: string | null, year: number, clearWear: boolean): Partial<TradeSceneInputs> {
  const id = HOME_MATERIAL_IDS.find(candidate => HOME_MATERIALS[candidate].replaceable === field)
  const optionOf = (property: PropertyProfile, materials: HomeMaterialFacts) => (id ? resolveHomeMaterials({ property, materials, year })[id]?.option : null) ?? null
  const before = optionOf(state.property, state.homeMaterials)

  if (isPropertyField(field)) {
    // propertyPatch clears the wear of a material whose option changes; going back to the era guess clears it whatever the option.
    const materials = id && clearWear ? withoutWear(state.homeMaterials, id) : state.homeMaterials
    return propertyPatch({ ...state, homeMaterials: materials }, { [field]: value }, year)
  }
  const recorded = { ...state.homeMaterials, [field]: value } as HomeMaterialFacts
  const materials = id && (clearWear || optionOf(state.property, recorded) !== before) ? withoutWear(recorded, id) : recorded
  return settled(state, state.property, materials, year)
}

export function homeMaterialPatch(state: PatchState, change: Extract<SceneChange, { kind: 'wear' | 'option' | 'era-guess' | 'fact' }>, year: number): Partial<TradeSceneInputs> {
  switch (change.kind) {
    case 'wear':
      return settled(state, state.property, { ...state.homeMaterials, wear: { ...state.homeMaterials.wear, [change.id]: change.wear } }, year)
    case 'option':
      return writeOption(state, change.field, change.value, year, false)
    case 'era-guess': {
      // Only the replaceable option goes back to the guess: the roof type, system type, equipment and gutters are facts about the home, not about this material's age.
      const field = HOME_MATERIALS[change.id].replaceable
      // The recorded levels were set against the paint being forgotten, so they go with its wear.
      const cleared = change.id === 'exterior-paint' ? { ...state, homeMaterials: { ...state.homeMaterials, paintWear: {} } } : state
      return field === null
        ? settled(state, state.property, withoutWear(state.homeMaterials, change.id), year)
        : writeOption(cleared, field, null, year, true)
    }
    case 'fact':
      return settled(state, state.property, { ...state.homeMaterials, ...change.patch }, year)
  }
}
