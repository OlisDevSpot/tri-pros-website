import type { HomeSpotContext, TradeSceneInputs } from '@/features/trade-scenes/types'

import { LEAVE_LOOK_INSIDE } from '@/features/trade-scenes/constants/scene-controls'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { canLookInside } from '@/features/trade-scenes/lib/systems-at-spot'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

// What a system's spot reads off the scene: the form the house is drawn with, the build's picks and the system type.
export function homeSpotContext(state: Pick<TradeSceneInputs, 'property' | 'proposedScopeIds'>): HomeSpotContext {
  return { form: homeRoofForm(roofFormOf(state.property.roofType)), picks: state.proposedScopeIds, hvacType: state.property.hvacType }
}

// A change that leaves the system in focus with nothing to look inside (a flat roof losing its redeck, a wall unit for
// the ducts) steps back to the system in the same write, so the card never frames an empty view. The system keeps the
// camera. Looking inside always has a system in focus.
export function keepLookInside(state: TradeSceneInputs): Partial<TradeSceneInputs> {
  if (!state.lookInside || canLookInside(state.cameraFocus!, homeSpotContext(state))) {
    return {}
  }
  return LEAVE_LOOK_INSIDE
}
