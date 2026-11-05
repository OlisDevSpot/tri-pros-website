import type { BoxSpec } from '@/features/trade-scenes/types'

import { ATTIC_JOIST_XS, ATTIC_SPANS, HOUSE, JOIST_DECK_GAP, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { atticJoistDepth } from '@/features/trade-scenes/lib/attic-insulation-boxes'

const { halfDepth: D, wallThickness: T, joistWidth } = HOUSE
const spanOf = ({ from, to }: { from: number, to: number }) => ({ depth: to - from, centre: (from + to) / 2 })
const OPEN_SPAN = spanOf(ATTIC_SPANS.open)
const COMPLETE_SPAN = spanOf(ATTIC_SPANS.complete)

// A flat roof's joists over the kitchen carry the roof kept there out to the front, so they always run the full span.
const runsFullSpan = (x: number, lowSlope: boolean) => lowSlope && x > HOUSE.cutX

// Under a flat roof the roof joists are the ceiling joists, so the joist space is this deep, less the gap: a top in the
// deck's underside plane, or an end in the plane of the deck's or fascia's front face, flickers against it.
function joistRise(lowSlope: boolean): number {
  return atticJoistDepth(lowSlope) - (lowSlope ? JOIST_DECK_GAP : 0)
}

function joists(lowSlope: boolean): BoxSpec[] {
  const depth = joistRise(lowSlope)
  const fullSpan = D * 2 - T - JOIST_DECK_GAP
  return ATTIC_JOIST_XS.map((x) => {
    const full = runsFullSpan(x, lowSlope)
    return { size: [joistWidth, depth, full ? fullSpan : OPEN_SPAN.depth], position: [x, WALL_TOP_Y + depth / 2, full ? -D + T + fullSpan / 2 : OPEN_SPAN.centre] }
  })
}

function completeJoists(lowSlope: boolean): BoxSpec[] {
  const depth = joistRise(lowSlope)
  return ATTIC_JOIST_XS.filter(x => !runsFullSpan(x, lowSlope))
    .map(x => ({ size: [joistWidth, depth, COMPLETE_SPAN.depth], position: [x, WALL_TOP_Y + depth / 2, COMPLETE_SPAN.centre] }))
}

export function atticJoistBoxes(lowSlope: boolean): { open: BoxSpec[], complete: BoxSpec[] } {
  return { open: joists(lowSlope), complete: completeJoists(lowSlope) }
}
