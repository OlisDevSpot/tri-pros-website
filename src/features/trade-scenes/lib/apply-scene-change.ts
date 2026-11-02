import type { SceneChange, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { RoofType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { efficiencyUpgradePatch } from '@/features/trade-scenes/lib/efficiency-upgrade-patch'
import { eraCodeLine } from '@/features/trade-scenes/lib/era-code-line'
import { homeMaterialPatch } from '@/features/trade-scenes/lib/home-material-patch'
import { propertyPatch } from '@/features/trade-scenes/lib/property-patch'
import { scopePick } from '@/features/trade-scenes/lib/scope-pick'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

// The form is read off the covering rather than stored. A pitched roof keeps its covering; coming from flat or unset it
// starts as shingle, the covering the scene already draws for an unset roof, so the controls and the house agree.
function roofTypeForForm(current: RoofType | null, form: RoofForm | null): RoofType | null {
  if (form === null) {
    return null
  }
  if (form === 'low-slope') {
    return 'flat'
  }
  return roofFormOf(current) === 'pitched' ? current : 'shingle'
}

// Use code puts back only materials with an era guess: the roof has none, and going back to its guess would clear the
// Condition the rep set.
function eraCodePatch(state: TradeSceneInputs, year: number): Partial<TradeSceneInputs> {
  const home = resolveHomeMaterials({ property: state.property, materials: state.homeMaterials, year })
  const coded = eraCodeLine({ property: state.property, home }).kept.reduce<TradeSceneInputs>(
    (next, id) => ({ ...next, ...homeMaterialPatch(next, { kind: 'era-guess', id }, year) }),
    state,
  )
  return { property: coded.property, homeMaterials: coded.homeMaterials, proposedScopeIds: coded.proposedScopeIds, efficiencyUpgrades: coded.efficiencyUpgrades }
}

export function applySceneChange(state: TradeSceneInputs, change: SceneChange, year: number): Partial<TradeSceneInputs> {
  switch (change.kind) {
    case 'property':
      return propertyPatch(state, change.patch, year)
    case 'roof-form':
      return propertyPatch(state, { roofType: roofTypeForForm(state.property.roofType, change.form) }, year)
    case 'wear':
    case 'option':
    case 'era-guess':
    case 'fact':
      return homeMaterialPatch(state, change, year)
    case 'era-code':
      return eraCodePatch(state, year)
    case 'scope':
      return scopePick(state, change.offer, change.scopeId)
    case 'efficiency-upgrade':
      return efficiencyUpgradePatch(state, change.upgrade, change.on)
    case 'household':
      return { household: { ...state.household, ...change.patch } }
    case 'climate':
      return { climate: change.climate }
    case 'bill':
      return { bills: { ...state.bills, [change.category]: { ...state.bills[change.category], now: change.now } } }
  }
}
