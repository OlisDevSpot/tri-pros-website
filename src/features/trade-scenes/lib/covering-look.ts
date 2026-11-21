import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { CoveringShares, CoveringWear } from '@/features/trade-scenes/types'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { COVERING_WEAR_START } from '@/features/trade-scenes/constants/covering-wear'
import { PAINT_WEAR_SHARE } from '@/features/trade-scenes/constants/paint-wear'
import { partState } from '@/features/trade-scenes/lib/part-state'

export interface CoveringLook extends PartState {
  levels: CoveringWear
  // The home's own pieces put back, so what a worn roof carries as breakage is cleaned off.
  reused: boolean
}

// partState already draws wear only for a kept or reused covering, so a covering with none to draw shows no level.
export function coveringLook(parts: readonly ResolvedPart[], levels: CoveringWear): CoveringLook {
  const state = partState(parts, 'covering')
  return {
    ...state,
    levels: state.wear > 0 ? levels : COVERING_WEAR_START.new,
    reused: parts.find(part => part.id === 'covering')?.reused === true,
  }
}

export function coveringShares(levels: CoveringWear): CoveringShares {
  return Object.fromEntries(Object.entries(levels).map(([kind, level]) => [kind, PAINT_WEAR_SHARE[level]])) as CoveringShares
}
