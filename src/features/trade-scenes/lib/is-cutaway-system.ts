import type { CutawayFaceSystemId, CutawaySystemId, HomeSystemId } from '@/features/trade-scenes/types'

import { CUTAWAY_FACE_FLOW_KEY } from '@/features/trade-scenes/constants/home-heat-lanes'

// The systems whose flows cross the house up close, through the parts the cutaway shows.
export function isCutawaySystem(system: HomeSystemId): system is CutawaySystemId {
  return system === 'roof' || system === 'attic'
}

// The systems whose heat crosses one face of the house up close: the window through its steps, the wall whole.
export function isCutawayFaceSystem(system: HomeSystemId): system is CutawayFaceSystemId {
  return system in CUTAWAY_FACE_FLOW_KEY
}
