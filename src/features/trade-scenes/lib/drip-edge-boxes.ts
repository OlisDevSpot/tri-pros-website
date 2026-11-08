import type { BoxSpec } from '@/features/trade-scenes/types'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { DECK_CENTRE, DECK_LENGTH, EAVE_RUN, FASCIA_CENTRE, HOUSE } from '@/features/trade-scenes/constants/home-geometry'

const { deckThickness: DECK, pitch } = HOUSE
const { fascia: FASCIA, rake: RAKE } = ROOF_TRIM
// The metal's gauge, its flange up the deck and its lip down the trim's face, which fits inside the gutter's standoff.
// Working numbers, set by eye.
const SHEET = 0.004
const FLANGE = 0.07
const LIP = 0.05
const RAKE_TOP = DECK + RAKE.proud

// In a slope's own frame. At the eave the flange lies on the deck's edge and the lip hangs plumb over the top of the fascia;
// up each real roof edge it caps the rake board and turns down its outer face. A cut edge has no rake, so no drip edge.
export function dripEdgeBoxes(zFrom: number, zTo: number, ends: readonly ('from' | 'to')[]): BoxSpec[] {
  const run = zTo - zFrom
  const zMid = (zFrom + zTo) / 2
  // The fascia is plumb, so its lip is set in the fascia's own turned frame and carried back into the slope's.
  const lipX = -(FASCIA.thickness + SHEET) / 2
  const lipY = (FASCIA.height - LIP) / 2
  const eaveLip: BoxSpec = {
    size: [SHEET, LIP, run],
    position: [FASCIA_CENTRE[0] + lipX * Math.cos(pitch) + lipY * Math.sin(pitch), FASCIA_CENTRE[1] - lipX * Math.sin(pitch) + lipY * Math.cos(pitch), zMid],
    rotation: [0, 0, -pitch],
  }
  const rakes = ends.flatMap((end): BoxSpec[] => {
    const outward = end === 'from' ? -1 : 1
    const edge = end === 'from' ? zFrom : zTo
    return [
      { size: [DECK_LENGTH, SHEET, RAKE.thickness + SHEET], position: [DECK_CENTRE, RAKE_TOP + SHEET / 2, edge + outward * (RAKE.thickness + SHEET) / 2] },
      { size: [DECK_LENGTH, LIP, SHEET], position: [DECK_CENTRE, RAKE_TOP - LIP / 2, edge + outward * (RAKE.thickness + SHEET / 2)] },
    ]
  })
  return [
    { size: [FLANGE, SHEET, run], position: [-EAVE_RUN + FLANGE / 2, DECK + SHEET / 2, zMid] },
    eaveLip,
    ...rakes,
  ]
}
