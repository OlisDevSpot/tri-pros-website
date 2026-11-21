import type { BoxSpec } from '@/features/trade-scenes/types'

import { WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { ATTIC_DUST } from '@/features/trade-scenes/constants/look-inside'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'

// The dust gathers where the leaking air comes through, so it lies on the ceiling round each opening, under whatever blanket
// is laid over it. Each patch is a flat box with no thickness, since a box's sides would carry the stain as a hard line round it.
export function ceilingOpeningDust(ducted: boolean): BoxSpec[] {
  return ceilingOpenings(ducted).map(opening => ({
    size: [ATTIC_DUST.size, 0, ATTIC_DUST.size],
    position: [opening.at[0], WALL_TOP_Y + ATTIC_DUST.lift, opening.at[1]],
  }))
}
