import type { HomeSystemId, SystemPartId, Vec3, WindowPieceId } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { CEILING_OPENING_LOOK } from '@/features/trade-scenes/constants/home-details'
import { ATTIC_FAN_SPOT, CEILING_OPENINGS, COVERING_BASE, EQUIPMENT, GUTTER_BACK, GUTTER_Y, HOUSE, HOUSE_WALLS, LOW_SLOPE, LOW_SLOPE_DECK_Y, LOW_SLOPE_ROOF_Y, RAFTER_ORIGIN_Y, RIDGE_Y, SLOPE_LENGTH, WALL_TOP_Y, WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { ATTIC_HEAT_LINE, DUCT_PIN_RISE, LOOK_INSIDE_WINDOW, PART_PIECES, STEP_DEPTHS } from '@/features/trade-scenes/constants/look-inside'
import { WINDOW_SEAL_LOOKS } from '@/features/trade-scenes/constants/system-part-looks'
import { atticJoistBoxes } from '@/features/trade-scenes/lib/attic-joist-boxes'
import { packageUnitPlacement } from '@/features/trade-scenes/lib/package-unit-placement'
import { stepBottom, stepCentre, stepCutBack, stepStarts } from '@/features/trade-scenes/lib/step-cut-back'
import { flashingBoxes } from '@/features/trade-scenes/lib/window-flashing-boxes'
import { windowPieceBoxes } from '@/features/trade-scenes/lib/window-piece-boxes'
import { windowSpread } from '@/features/trade-scenes/lib/window-spread'

const { pitch } = HOUSE

// A point on a gable slope: `along` up it from the rafters' line at the wall, `depth` out from the rafters' top, `back`
// for the far slope.
function slopePoint(x: number, along: number, depth: number, back = false): Vec3 {
  const z = HOUSE.halfDepth - along * Math.cos(pitch) + depth * Math.sin(pitch)
  return [x, RAFTER_ORIGIN_Y + along * Math.sin(pitch) + depth * Math.cos(pitch), back ? -z : z]
}

const MID_SLOPE = SLOPE_LENGTH / 2
const CEILING_Y = WALL_TOP_Y - HOUSE.ceilingThickness
// The window its system's view looks at: `along` its wall, the wall's outer face `face` across it.
const { wall: WINDOW_WALL, opening: WINDOW_OPENING } = LOOK_INSIDE_WINDOW
const WINDOW = {
  along: WINDOW_OPENING.along,
  halfWidth: WINDOW_OPENING.width / 2,
  sill: HOUSE.floorY + WINDOW_OPENING.sill,
  head: HOUSE.floorY + WINDOW_OPENING.head,
  face: WINDOW_WALL.line + WINDOW_WALL.outward * HOUSE.wallThickness / 2,
}
// The axis across the window's wall, which its parts stack on.
const WINDOW_ACROSS = WINDOW_WALL.run === 'z' ? 0 : 2
// A point on the window's wall, `along` it, at `y`, standing at `across` on the axis across it.
const onWindowWall = (along: number, y: number, across: number): Vec3 => WINDOW_WALL.run === 'x' ? [along, y, across] : [across, y, along]
const ductC = EQUIPMENT.ductRuns[2]
// Up close the attic is looked at by the cut, round the strip its floor's bottom step shows bare, where the parts that keep
// their place are pointed at. Air sealing is pointed at the foam round the light can nearest that strip, which every home
// has, ducts or none.
const BY_THE_CUT = stepCentre('attic', HOUSE.cutX, 1)
// The heat comes down onto the blanket's step, the step over the bare strip, through the foil on its way.
const ON_THE_BLANKET = stepCentre('attic', HOUSE.cutX + STEP_DEPTHS.attic, 1)
const SEALED_CAN = CEILING_OPENINGS.filter(opening => opening.kind === 'can').reduce((best, opening) => Math.abs(opening.at[0] - BY_THE_CUT) < Math.abs(best.at[0] - BY_THE_CUT) ? opening : best)
// The blanket's pin stands this far past the strip's middle, this far over the joists' tops and this far behind the kept
// cut edge, clear of the heat coming down onto its step; the ceiling's that far behind it, this far along the strip, clear of
// the ceiling's reading; the foil's this far past where the heat meets it on the back slope, clear of the arrows; the air
// sealing's this far over the can's foam, so the pin leaves the foam round it in sight. Working numbers, set by a dark shot.
const ATTIC_PIN = { blanketAside: 0.7, blanketRise: 0.12, blanketBack: 0.6, ceilingBack: 0.3, ceilingAside: 0, foilAside: 0.45, sealRise: 0.25 } as const
// The ceiling joist nearest the strip, pointed at on its top this far behind the kept cut edge, clear of the ceiling's and the
// blanket's pins. A working number, set by a dark shot.
const JOIST_BACK = 1.2
const JOIST_POINT: Vec3 = (() => {
  const joist = atticJoistBoxes(false).open.reduce((best, box) => Math.abs(box.position[0] - BY_THE_CUT) < Math.abs(best.position[0] - BY_THE_CUT) ? box : best)
  return [joist.position[0], joist.position[1] + joist.size[1] / 2, HOUSE.atticFrontZ - JOIST_BACK]
})()
// Under either roof the blanket lies on the attic floor, on the span the open house keeps.
const BLANKET_POINT: Vec3 = [BY_THE_CUT + ATTIC_PIN.blanketAside, WALL_TOP_Y + ATTIC_PIN.blanketRise, HOUSE.atticFrontZ - ATTIC_PIN.blanketBack]

// The flashing's lining along the sill, the same round either frame: its top is what the pulled frame uncovers.
const SILL_LINING = flashingBoxes(WINDOW_FRAMES.double).reduce((low, box) => box.position[1] < low.position[1] ? box : low)
// Where the window's parts stand at rest, before the pull moves them: the frame at its head's corner, the seals on the bead
// along the sill, the flashing on top of its sill lining, along from the seals' pin. Working numbers, set by eye.
const WINDOW_POINTS: Partial<Record<SystemPartId, Vec3>> = {
  frame: onWindowWall(WINDOW.along - WINDOW.halfWidth + 0.05, WINDOW.head - 0.05, WINDOW.face),
  seals: onWindowWall(WINDOW.along, WINDOW.sill + WINDOW_SEAL_LOOKS.seals.width / 2, WINDOW.face),
  flashing: onWindowWall(WINDOW.along - 0.3, SILL_LINING.position[1] + SILL_LINING.size[1] / 2, SILL_LINING.position[WINDOW_ACROSS]),
}
// Each glazing piece's pin stands on the piece, this far up the glass from the sill and toward its near end, so the pins
// stand apart down the glass. Working numbers, set by eye.
const PIECE_PIN_RISE: Record<WindowPieceId, number> = { 'pane': 0.35, 'inner-pane': 0.25, 'argon': 0.45, 'air-gap': 0.45, 'low-e': 0.65, 'outer-pane': 0.85, 'screen': 1.05 }
const PIECE_PIN_ALONG = WINDOW.along - 0.2

// The left wall's window, which every home view draws: the whole home's window spot stands on its glass.
const SPOT_WINDOW = HOUSE_WALLS.left.openings[0]
// Where each system part sits on the house at rest, before the foundation lifts it: the whole window glass, which its spot
// points at, and the equipment. Working numbers, set by eye.
const SHARED_POINTS: Partial<Record<SystemPartId, Vec3>> = {
  'glazing': [-HOUSE.halfLength, HOUSE.floorY + SPOT_WINDOW.sill + 0.75, SPOT_WINDOW.along + 0.25],
  'condenser': [EQUIPMENT.condenser.position[0], 0.55, EQUIPMENT.condenser.position[2]],
  'refrigerant-lines': [-HOUSE.halfLength - 0.15, 0.4, EQUIPMENT.condenser.position[2] + 0.5],
  'air-handler': EQUIPMENT.plenum.position,
  'duct-runs': ductC[1],
}

// The roof's and the attic's, and the package unit's, by roof form: on a gable the layers stand in section at the near
// slope's cut, a little further down it each, and the attic's parts at the spots its view sees; on a flat roof the layers
// stack at the same cut. Working numbers, set by eye.
const ROOF_POINTS: Record<RoofForm, Partial<Record<SystemPartId, Vec3>>> = {
  'pitched': {
    'covering': slopePoint(HOUSE.cutX, MID_SLOPE, COVERING_BASE + 0.03),
    'underlayment': slopePoint(HOUSE.cutX, MID_SLOPE - 0.4, HOUSE.deckThickness + HOUSE.underlaymentThickness / 2),
    'deck': slopePoint(HOUSE.cutX, MID_SLOPE - 0.8, HOUSE.deckThickness / 2),
    'rafters': slopePoint(HOUSE.cutX, MID_SLOPE - 1.2, -HOUSE.rafterDepth / 2),
    'ice-and-water': slopePoint(HOUSE.cutX, 0.3, HOUSE.deckThickness + HOUSE.underlaymentThickness),
    'drip-edge': slopePoint(HOUSE.cutX, -HOUSE.eaveOverhang / Math.cos(pitch), COVERING_BASE),
    'ridge-vent': [HOUSE.cutX, RIDGE_Y + COVERING_BASE / Math.cos(pitch) + 0.05, 0],
    'gutter': [HOUSE.cutX, GUTTER_Y, HOUSE.halfDepth + GUTTER_BACK],
    'radiant-barrier': slopePoint(ON_THE_BLANKET + ATTIC_PIN.foilAside, ATTIC_HEAT_LINE.along - ATTIC_HEAT_LINE.barrierAlong, -HOUSE.rafterDepth - 0.01, true),
    'attic-insulation': BLANKET_POINT,
    'ceiling-joists': JOIST_POINT,
    'air-sealing': [SEALED_CAN.at[0], WALL_TOP_Y + CEILING_OPENING_LOOK.collar.height + ATTIC_PIN.sealRise, SEALED_CAN.at[1]],
    'attic-fan': ATTIC_FAN_SPOT.position,
    'package-unit': packageUnitPlacement(false, 1).position,
  },
  'low-slope': {
    'covering': [HOUSE.cutX, LOW_SLOPE_ROOF_Y, HOUSE.halfDepth / 2],
    'underlayment': [HOUSE.cutX, LOW_SLOPE_DECK_Y + HOUSE.deckThickness, HOUSE.halfDepth / 2 + 0.3],
    'deck': [HOUSE.cutX, LOW_SLOPE_DECK_Y + HOUSE.deckThickness / 2, HOUSE.halfDepth / 2 + 0.6],
    'rafters': [HOUSE.cutX, WALL_TOP_Y + LOW_SLOPE.joistSpace / 2, HOUSE.halfDepth / 2 + 1.2],
    'gutter': [HOUSE.cutX, LOW_SLOPE_ROOF_Y, -HOUSE.halfDepth],
    'attic-insulation': BLANKET_POINT,
    'package-unit': packageUnitPlacement(true, 1).position,
  },
}

// The ceiling is lit for its story in each system, so it is pointed at where that story shows: the roof's leak coming
// through it, or, for the attic, its kept cut edge by the strip its bottom step shows bare, where the gaps above it show.
const CEILING_POINTS = {
  roof: [LEAK.spot[0], CEILING_Y, LEAK.spot[1]],
  attic: [BY_THE_CUT + ATTIC_PIN.ceilingAside, CEILING_Y, HOUSE.atticFrontZ - ATTIC_PIN.ceilingBack],
} as const satisfies Partial<Record<HomeSystemId, Vec3>>

// The point `along` metres down a run's line from its plenum end.
function pointAlong(run: readonly Vec3[], along: number): Vec3 {
  const lengths = run.slice(1).map((to, index) => Math.hypot(to[0] - run[index][0], to[1] - run[index][1], to[2] - run[index][2]))
  let index = 0
  let left = along
  while (index < lengths.length - 1 && left > lengths[index]) {
    left -= lengths[index]
    index += 1
  }
  const [from, to] = [run[index], run[index + 1]]
  const share = left / lengths[index]
  return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share, from[2] + (to[2] - from[2]) * share]
}

// A piece of the duct run, pointed at the middle of the strip its step shows: from where it is cut back to where the piece
// over it starts. Null for anything else, or a piece that is not showing.
function pieceFocus(id: SystemPartId, peel: number, shown: ReadonlySet<SystemPartId>, ductRun: readonly Vec3[]): Vec3 | null {
  const order = PART_PIECES['duct-runs'].filter(piece => shown.has(piece))
  const index = order.indexOf(id)
  if (index < 0) {
    return null
  }
  const step = STEP_DEPTHS['heating-cooling']
  const cut = stepCutBack(index, order.length, peel, step)
  const strip = step * Math.min(Math.max(peel, 0), 1)
  const [x, y, z] = pointAlong(ductRun, cut + strip / 2)
  return [x, y + DUCT_PIN_RISE[id as keyof typeof DUCT_PIN_RISE], z]
}

// A window part where it stands at rest: a glazing piece on its own glass, the window's other parts at their points.
function windowRestingPoint(id: SystemPartId, shown: ReadonlySet<SystemPartId>): Vec3 | null {
  const piece = windowPieceBoxes(WINDOW_FRAMES[shown.has('pane') ? 'single' : 'double'], shown).find(entry => entry.id === id)
  if (piece === undefined) {
    return WINDOW_POINTS[id] ?? SHARED_POINTS[id] ?? null
  }
  return onWindowWall(PIECE_PIN_ALONG, WINDOW.sill + PIECE_PIN_RISE[piece.id], piece.boxes[0].position[WINDOW_ACROSS])
}

function restingPoint(system: HomeSystemId, form: RoofForm, id: SystemPartId): Vec3 | null {
  if (id === 'ceiling') {
    return system === 'roof' ? CEILING_POINTS.roof : CEILING_POINTS.attic
  }
  return ROOF_POINTS[form][id] ?? SHARED_POINTS[id] ?? null
}

// Null for a part with no place on this roof. A part the roof or the attic steps open is pointed at the middle of the strip
// its step shows, which moves with the peel and with the other parts `shown` above and below it; the bottom step, whole
// on both sides of the cut, keeps its resting point. A window part is pointed at where it stands at rest, moved out as far as
// the pull (`peel`) has moved it. A piece of the duct run is pointed at its own step, along `ductRun`, the line the house
// draws the opened run on (hung or laid); with no duct piece shown it is never read. The wall is looked inside whole, so
// none of its parts has a place.
export function systemPartFocus(system: HomeSystemId, form: RoofForm, id: SystemPartId, peel: number, shown: Iterable<SystemPartId>, ductRun: readonly Vec3[]): Vec3 | null {
  if (system === 'windows') {
    const set = new Set(shown)
    const point = windowRestingPoint(id, set)
    const offset = windowSpread(set, peel).get(id)
    return point === null || offset === undefined ? point : [point[0] + offset[0], point[1] + offset[1], point[2] + offset[2]]
  }
  if (system === 'heating-cooling') {
    const piece = pieceFocus(id, peel, new Set(shown), ductRun)
    if (piece !== null) {
      return piece
    }
  }
  const point = restingPoint(system, form, id)
  if (point === null || (system !== 'roof' && system !== 'attic')) {
    return point
  }
  const start = stepStarts(system, shown, peel).get(id)
  return start === undefined || stepBottom(shown) === id ? point : [stepCentre(system, start, peel), point[1], point[2]]
}
