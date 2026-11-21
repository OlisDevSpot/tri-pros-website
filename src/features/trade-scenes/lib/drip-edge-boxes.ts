import type { BoxSpec } from '@/features/trade-scenes/types'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { DECK_CENTRE, DECK_LENGTH, EAVE_RUN, FASCIA_CENTRE, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'

const { deckThickness: DECK, pitch } = HOUSE
const { dripEdge: { sheet: SHEET, flange: FLANGE, lip: LIP }, fascia: FASCIA, rake: RAKE } = ROOF_TRIM
const RAKE_TOP = DECK + RAKE.proud

// In a slope's own frame: the lip hangs plumb over the top of the fascia. The fascia is plumb, so its lip is set in the
// fascia's own turned frame and carried back into the slope's. It stands off the board by a replaced length's lift, so it
// laps a new board too instead of sharing its face and flickering against it.
export function eaveLipBox(zFrom: number, zTo: number): BoxSpec {
  const lipX = -(FASCIA.thickness / 2 + CUTAWAY_ROT.lift + SHEET / 2)
  const lipY = (FASCIA.height - LIP) / 2
  return {
    size: [SHEET, LIP, zTo - zFrom],
    position: [FASCIA_CENTRE[0] + lipX * Math.cos(pitch) + lipY * Math.sin(pitch), FASCIA_CENTRE[1] - lipX * Math.sin(pitch) + lipY * Math.cos(pitch), (zFrom + zTo) / 2],
    rotation: [0, 0, -pitch],
  }
}

// In a slope's own frame. At the eave the flange lies on the deck's edge and the lip hangs plumb over the top of the fascia;
// up each real roof edge it caps the rake board and turns down its outer face. A cut edge has no rake, so no drip edge.
export function dripEdgeBoxes(zFrom: number, zTo: number, ends: readonly ('from' | 'to')[]): BoxSpec[] {
  const run = zTo - zFrom
  const zMid = (zFrom + zTo) / 2
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
    eaveLipBox(zFrom, zTo),
    ...rakes,
  ]
}
