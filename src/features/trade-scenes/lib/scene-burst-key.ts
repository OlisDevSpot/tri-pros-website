import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { houseOpen } from '@/features/trade-scenes/lib/house-open'

// Every input that changes what the home is living through wakes it, and so does Look inside, so a rep who goes up close
// after the home went still sees it move; the peel, the thermal camera and the look only redraw. The home view wakes the
// home too: residents move as the house opens. The whole home materials slot wakes it, since a wear change can switch the leak and the
// residents on or off. A string, so a store write that changes none of these selects an equal
// value and re-renders nothing. The climate is the one the scene draws, so setting it to the one it already falls back on
// wakes nothing.
export function sceneBurstKey(state: TradeSceneInputs): string {
  return JSON.stringify([state.view, houseOpen(state), state.weather, state.climate ?? CLIMATE_FALLBACK, state.proposedScopeIds, state.efficiencyUpgrades, state.installStyles, state.homeMaterials, state.household, state.property, state.lookInside])
}
