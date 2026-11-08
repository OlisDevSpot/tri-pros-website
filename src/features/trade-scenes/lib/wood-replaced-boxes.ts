import type { CutawayRotSpot, TintedBoxes } from '@/features/trade-scenes/types'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'

// Where the build cut the old deck's rot out, a square-cornered sheet of fresh wood through the deck, its edges along the strip
// and up the slope, over a darker seam a little wider and a hair under its faces, so it reads as a piece set in.
export function woodReplacedBoxes(spots: readonly CutawayRotSpot[]): [seams: TintedBoxes, sheets: TintedBoxes] {
  const replaced = spots.filter(spot => spot.woodReplaced)
  return [
    {
      color: HOME_PALETTE.woodSeam,
      boxes: replaced.map(spot => ({
        size: [spot.size[0] + CUTAWAY_ROT.seam * 2, spot.thickness - CUTAWAY_ROT.lift, spot.size[1] + CUTAWAY_ROT.seam * 2],
        position: spot.position,
        rotation: [spot.tilt, 0, 0],
      })),
    },
    {
      color: HOME_PALETTE.woodReplaced,
      boxes: replaced.map(spot => ({ size: [spot.size[0], spot.thickness, spot.size[1]], position: spot.position, rotation: [spot.tilt, 0, 0] })),
    },
  ]
}
