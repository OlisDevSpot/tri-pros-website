import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { fasciaRotInForce } from '@/features/trade-scenes/lib/paint-wear-in-force'
import { FASCIA_REPLACEMENT_SCOPE_ID } from '@/shared/modules/construction/core/constants/fascia-replacement'
import { resolveHomeMaterials } from '@/shared/modules/construction/core/lib/resolve-home-materials'

// The replacement is offered only for rot the rep has set, so whatever takes the rot back to None takes the pick with it:
// no switch is left on that the card no longer shows.
export function keepFasciaReplacement(state: TradeSceneInputs, year: number): string[] {
  const home = resolveHomeMaterials({ property: state.property, materials: state.homeMaterials, year })
  const rot = fasciaRotInForce(home, state.homeMaterials.paintWear)
  return rot === 'none' ? state.proposedScopeIds.filter(id => id !== FASCIA_REPLACEMENT_SCOPE_ID) : state.proposedScopeIds
}
