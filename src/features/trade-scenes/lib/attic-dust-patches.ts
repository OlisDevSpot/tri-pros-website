import type { BoxSpec } from '@/features/trade-scenes/types'

import { WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { ATTIC_DUST } from '@/features/trade-scenes/constants/look-inside'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { laidInsulationDepth } from '@/features/trade-scenes/lib/laid-insulation-depth'

// One flat patch of dust on the blanket's top over each ceiling opening the home has. `from` is where the blanket's step
// starts: the strip before it is bare, so the openings there show their gaps instead of dirt floating in the air.
export function atticDustPatches(material: string | null, lowSlope: boolean, ducted: boolean, from: number | null): BoxSpec[] {
  if (material === null) {
    return []
  }
  const y = WALL_TOP_Y + laidInsulationDepth(material, lowSlope) + ATTIC_DUST.lift
  return ceilingOpenings(ducted)
    .filter(opening => from === null || opening.at[0] >= from)
    .map(opening => ({ size: [ATTIC_DUST.size, ATTIC_DUST.thickness, ATTIC_DUST.size], position: [opening.at[0], y, opening.at[1]] }))
}
