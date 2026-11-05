import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { HOME_MATERIAL_FACTS_UNSET } from '@/shared/modules/construction/core/constants/home-materials'

// Nothing known about the home or the household: the scene must still draw, in typical wording, with a neutral couple.
export const HOME_SCENE_DEFAULTS: TradeSceneInputs = {
  property: {
    yearBuilt: null,
    roofType: null,
    foundationType: null,
    hvacType: null,
    insulationLevel: null,
    windowsType: null,
    hvacComponents: null,
  },
  household: { type: null, ageGroup: null },
  view: 'existing',
  weather: 'normal',
  climate: null,
  homeView: 'complete',
  thermalCamera: false,
  lookInside: false,
  proposedScopeIds: [],
  efficiencyUpgrades: ['cool-roof', 'cool-paint'],
  installStyles: [],
  homeMaterials: HOME_MATERIAL_FACTS_UNSET,
  cameraFocus: null,
  peel: 0,
  emphasizedPart: null,
  bills: {
    electric: { now: null, cut: { mode: 'trades', value: null } },
    gas: { now: null, cut: { mode: 'trades', value: null } },
  },
  repairsOverrides: {},
}
