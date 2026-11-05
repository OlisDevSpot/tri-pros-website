import type { BoxSpec } from '@/features/trade-scenes/types'

import { FRONT_CORNERS, FRONT_WALL, FRONT_WALL_PROUD, HOUSE, LOW_SLOPE, LOW_SLOPE_DECK_Y, PARAPET_TOP, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'

const { halfLength: L, halfDepth: D, wallThickness: T, deckThickness: DECK, cutX } = HOUSE
const MEMBRANE_Y = LOW_SLOPE_DECK_Y + DECK
const PARAPET_HEIGHT = PARAPET_TOP - WALL_TOP_Y

// Kept over the back half and over the kitchen; cut away over the rest so the thin joist space reads at the cut edges. It
// stops at the parapets' inner faces: an end in the plane of a parapet's outer face shows through it.
const INNER = L - T
function roofArea(y: number, height: number): BoxSpec[] {
  return [
    { size: [INNER * 2, height, D - T], position: [0, y + height / 2, (T - D) / 2] },
    { size: [INNER - cutX, height, D], position: [(INNER + cutX) / 2, y + height / 2, D / 2] },
  ]
}

// The Complete house's roof over the front left, where Partly open cuts it away.
function frontLeftArea(y: number, height: number): BoxSpec[] {
  return [{ size: [INNER + cutX, height, D], position: [(cutX - INNER) / 2, y + height / 2, D / 2] }]
}

// Closes the kept front edge of the joist space in both views. Its face sits a millimetre inside the Complete house's front
// parapet, so the closed house hides it and the parapet can lift off without ever showing the joist ends behind it.
const FASCIA_THICKNESS = 0.035
// A working number. The fascia stops this far short of the right parapet's outer face and the kitchen deck's cut end: an end
// in either plane flickers against it, and 2 mm is too little to show.
const FASCIA_END_GAP = 0.002
const FASCIA_FROM = cutX + FASCIA_END_GAP
const FASCIA_TO = L - FASCIA_END_GAP
const FASCIA_HEIGHT = LOW_SLOPE.joistSpace + DECK

// The front wall's corners carried up with it, so the front parapet's step past the side parapets closes too.
const parapetCorners = (): BoxSpec[] => FRONT_CORNERS.map(({ size, position }) => ({ size: [size[0], PARAPET_HEIGHT, size[2]], position: [position[0], WALL_TOP_Y + PARAPET_HEIGHT / 2, position[2]] }))

type LowSlopeRoofPart = 'deck' | 'membrane' | 'completeDeck' | 'completeMembrane' | 'parapets' | 'completeParapets' | 'parapetCorners' | 'frontFascia'

export function lowSlopeRoofBoxes(): Record<LowSlopeRoofPart, BoxSpec[]> {
  return {
    deck: roofArea(LOW_SLOPE_DECK_Y, DECK),
    membrane: roofArea(MEMBRANE_Y, LOW_SLOPE.membraneThickness),
    completeDeck: frontLeftArea(LOW_SLOPE_DECK_Y, DECK),
    completeMembrane: frontLeftArea(MEMBRANE_Y, LOW_SLOPE.membraneThickness),
    parapets: [
      { size: [L * 2, PARAPET_HEIGHT, T], position: [0, WALL_TOP_Y + PARAPET_HEIGHT / 2, -D + T / 2] },
      { size: [T, PARAPET_HEIGHT, D * 2 - T], position: [L - T / 2, WALL_TOP_Y + PARAPET_HEIGHT / 2, T / 2] },
      { size: [T, PARAPET_HEIGHT, D - T], position: [-L + T / 2, WALL_TOP_Y + PARAPET_HEIGHT / 2, -D / 2 + T / 2] },
    ],
    // The front wall carried up between the side parapets, and the left one's front half.
    completeParapets: [
      { size: [L * 2 - T * 2, PARAPET_HEIGHT, T], position: [0, WALL_TOP_Y + PARAPET_HEIGHT / 2, FRONT_WALL.line] },
      { size: [T, PARAPET_HEIGHT, D], position: [-L + T / 2, WALL_TOP_Y + PARAPET_HEIGHT / 2, D / 2] },
    ],
    parapetCorners: parapetCorners(),
    frontFascia: [
      { size: [FASCIA_TO - FASCIA_FROM, FASCIA_HEIGHT, FASCIA_THICKNESS], position: [(FASCIA_FROM + FASCIA_TO) / 2, WALL_TOP_Y + FASCIA_HEIGHT / 2, D + FRONT_WALL_PROUD - 0.001 - FASCIA_THICKNESS / 2] },
    ],
  }
}
