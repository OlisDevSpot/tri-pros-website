import type { CutawayRotSpot, CutawaySteps, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { EAVE_RUN, HOUSE, RAFTER_ORIGIN_Y, SLOPE_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { CUTAWAY_ROT, STEP_DEPTHS } from '@/features/trade-scenes/constants/look-inside'
import { cutawayCrossings } from '@/features/trade-scenes/lib/cutaway-rain-path'
import { stepStarts } from '@/features/trade-scenes/lib/step-cut-back'

const { pitch, halfDepth: D, wallThickness: T } = HOUSE

// The near slope's run the deck's step spans, in metres up the slope from the rafters' line at the wall: eave to ridge on a
// gable. A flat roof's runs from its front wall to its back parapet, as a z.
const PITCHED_RUN = { from: -EAVE_RUN, to: SLOPE_LENGTH } as const
const LOW_SLOPE_RUN = { from: D, to: -D + T } as const

// Every old deck is taken to have three rotted areas, whatever its covering's wear. They sit on the deck's step, the same in
// the existing and the proposed view; the build shows them as replaced wood when it takes the old roof off to the deck, and
// an installed deck is all new wood, with none.
export function deckRotSpots(form: RoofForm, parts: readonly ResolvedPart[], steps: CutawaySteps): CutawayRotSpot[] {
  const deck = parts.find(part => part.id === 'deck' && part.material !== null)
  const start = stepStarts(steps.system, steps.shown, steps.peel).get('deck')
  const crossing = cutawayCrossings(form, parts, steps, 'rain').find(candidate => candidate.partId === 'deck')!
  if (!deck || deck.condition === 'installed' || start === undefined || steps.peel <= 0) {
    return []
  }

  const stripLength = STEP_DEPTHS.roof * Math.min(steps.peel, 1)
  const pitched = form === 'pitched'
  const run = pitched ? PITCHED_RUN.to - PITCHED_RUN.from : LOW_SLOPE_RUN.to - LOW_SLOPE_RUN.from
  const centre: Vec3 = [(crossing.outer[0] + crossing.inner[0]) / 2, (crossing.outer[1] + crossing.inner[1]) / 2, (crossing.outer[2] + crossing.inner[2]) / 2]
  const along = pitched ? (centre[1] - RAFTER_ORIGIN_Y) * Math.sin(pitch) + (D - centre[2]) * Math.cos(pitch) : 0

  return CUTAWAY_ROT.deck.sheets.map(({ across, up }) => {
    const acrossMid = (across[0] + across[1]) / 2
    const upMid = (up[0] + up[1]) / 2
    const position: Vec3 = pitched
      ? [start + acrossMid * stripLength, centre[1] + (PITCHED_RUN.from + upMid * run - along) * Math.sin(pitch), centre[2] - (PITCHED_RUN.from + upMid * run - along) * Math.cos(pitch)]
      : [start + acrossMid * stripLength, centre[1], LOW_SLOPE_RUN.from + upMid * run]
    return {
      partId: 'deck',
      position,
      tilt: pitched ? pitch : 0,
      thickness: HOUSE.deckThickness + CUTAWAY_ROT.lift * 2,
      size: [(across[1] - across[0]) * stripLength, Math.abs((up[1] - up[0]) * run)],
      ...(deck.woodReplaced ? { woodReplaced: true as const } : {}),
    }
  })
}
