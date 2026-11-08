import type { HomeSystemId, PeeledSystemId } from '@/features/trade-scenes/types'

import { FULLY_OPEN_SYSTEMS, PULLED_APART_SYSTEMS, STEP_DEPTHS } from '@/features/trade-scenes/constants/look-inside'

// The slider shows only where there is something to drag: a system that pulls apart, or one with a step depth that does not
// stand fully open.
export function peels(system: HomeSystemId): system is PeeledSystemId {
  return PULLED_APART_SYSTEMS.has(system) || (system in STEP_DEPTHS && !FULLY_OPEN_SYSTEMS.has(system))
}
