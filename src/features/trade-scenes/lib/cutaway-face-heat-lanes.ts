import type { ArrowLane, FaceLegPoints, HomeHeat, SystemPartId, Vec3 } from '@/features/trade-scenes/types'
import type { ResolvedPart, Season } from '@/shared/modules/construction/core/types'

import { HOUSE, WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import { CUTAWAY_FACE_FLOW_KEY, faceBounceTo, OPEN_LANE_REACH, wallPoint } from '@/features/trade-scenes/constants/home-heat-lanes'
import { LOOK_INSIDE_WALL, LOOK_INSIDE_WINDOW, WINDOW_LANE_ALONG } from '@/features/trade-scenes/constants/look-inside'
import { heatLaneFlows } from '@/features/trade-scenes/lib/heat-lane-flows'
import { faceLegs } from '@/features/trade-scenes/lib/home-heat-lanes'
import { windowPieceBoxes } from '@/features/trade-scenes/lib/window-piece-boxes'
import { windowSpread } from '@/features/trade-scenes/lib/window-spread'

// The window's lane crosses its opening this share of the way up from the sill, where the whole home's window lane runs.
const WINDOW_LANE_RISE = 0.5
// Floating-point room for two pieces that meet at one depth.
const DEPTH_TOLERANCE = 1e-9

// The window up close takes its own parts, for its glazing, and how far the slider has pulled it apart; the wall is looked
// inside whole, so it takes only what it shows.
type CutawayFace
  = | { system: 'windows', parts: readonly ResolvedPart[], shown: ReadonlySet<SystemPartId>, peel: number }
    | { system: 'walls', shown: ReadonlySet<SystemPartId> }

// The window's legs: from the yard onto the outer piece, on through every shown piece into the room, crossing each along the
// wall's outward normal where the pull has moved it, so pulled apart the arrows pass through the gaps; the Low-E coating,
// where it is shown, turns the bounce back out from its own face, and single pane glass lets it all through.
function windowLegs(parts: readonly ResolvedPart[], shown: ReadonlySet<SystemPartId>, pull: number): FaceLegPoints {
  const { wall, opening } = LOOK_INSIDE_WINDOW
  // Unknown glazing draws as single, as the house draws it.
  const double = parts.find(part => part.id === 'glazing')?.material === 'double-pane'
  const pieces = windowPieceBoxes(WINDOW_FRAMES[double ? 'double' : 'single'], shown).reverse()
  const spread = windowSpread(shown, pull)
  const across = wall.run === 'z' ? 0 : 2
  const along = WINDOW_LANE_ALONG
  const y = HOUSE.floorY + opening.sill + (opening.head - opening.sill) * WINDOW_LANE_RISE
  // Each piece crossed through its depth, its outside face first, outermost first; a piece whose depth the lane has already
  // crossed is passed over, so the lane never turns back toward the yard.
  const crossings: { id: SystemPartId, outer: Vec3, inner: Vec3 }[] = []
  let reached = Infinity
  for (const { id, boxes: [box] } of pieces) {
    const out = (box.position[across] + spread.get(id)![across] - wall.line) * wall.outward
    const half = box.size[across] / 2
    if (out + half > reached + DEPTH_TOLERANCE) {
      continue
    }
    crossings.push({ id, outer: wallPoint(wall, along, y, out + half), inner: wallPoint(wall, along, y, out - half) })
    reached = out - half
  }
  const turning = crossings.find(crossing => crossing.id === 'low-e')
  return {
    outside: [wallPoint(wall, along, y, OPEN_LANE_REACH), crossings[0].outer],
    // A piece's inside face is the next one's outside face while the window is whole; the arrows pass over the zero-length leg.
    inside: [...crossings.flatMap(crossing => [crossing.outer, crossing.inner]), wallPoint(wall, along, y, -OPEN_LANE_REACH)],
    bounce: turning === undefined ? null : [turning.outer, faceBounceTo(wall, along, y)],
  }
}

// The wall's legs, where its Look inside looks: from the yard onto its outer face, across its whole depth once to its inner
// face, into the room; the paint, where it is shown, turns the bounce back out from the outer face.
function wallLegs(shown: ReadonlySet<SystemPartId>): FaceLegPoints {
  const { wall, along, height } = LOOK_INSIDE_WALL
  const y = HOUSE.floorY + height
  const outer = wallPoint(wall, along, y, HOUSE.wallThickness / 2)
  return {
    outside: [wallPoint(wall, along, y, OPEN_LANE_REACH), outer],
    inside: [outer, wallPoint(wall, along, y, -HOUSE.wallThickness / 2), wallPoint(wall, along, y, -OPEN_LANE_REACH)],
    bounce: shown.has('paint') ? [outer, faceBounceTo(wall, along, y)] : null,
  }
}

// The window's or the wall's lanes for the home's heat, counted from the same table as the whole home's face so the arrows
// agree with it, and drawn by the same legs. In summer the face's bounce turns back out where the table has one; winter runs
// the same legs out, with nothing to bounce.
export function cutawayFaceHeatLanes(face: CutawayFace, heat: HomeHeat, season: Season): ArrowLane[] {
  const flows = heatLaneFlows(heat)
  const key = CUTAWAY_FACE_FLOW_KEY[face.system]
  const legs = face.system === 'windows' ? windowLegs(face.parts, face.shown, face.peel) : wallLegs(face.shown)
  return faceLegs(legs, flows[key], flows[`${key}Bounce`], season).filter(lane => lane.count > 0)
}
