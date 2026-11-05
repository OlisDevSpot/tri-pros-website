import type { HomeSystemId, SystemPartId, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { READING_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { ATTIC_FAN_SPOT, COVERING_BASE, EQUIPMENT, GUTTER_BACK, GUTTER_Y, HOUSE, HOUSE_WALLS, LOW_SLOPE, LOW_SLOPE_DECK_Y, LOW_SLOPE_ROOF_Y, RAFTER_ORIGIN_Y, RIDGE_Y, SLOPE_LENGTH, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { packageUnitPlacement } from '@/features/trade-scenes/lib/package-unit-placement'

const { pitch } = HOUSE

// A point on a gable slope: `along` up it from the rafters' line at the wall, `depth` out from the rafters' top, `back`
// for the far slope.
function slopePoint(x: number, along: number, depth: number, back = false): Vec3 {
  const z = HOUSE.halfDepth - along * Math.cos(pitch) + depth * Math.sin(pitch)
  return [x, RAFTER_ORIGIN_Y + along * Math.sin(pitch) + depth * Math.cos(pitch), back ? -z : z]
}

const MID_SLOPE = SLOPE_LENGTH / 2
const CEILING_Y = WALL_TOP_Y - HOUSE.ceilingThickness
// The left wall's window, the one its system's view looks at.
const LEFT_WINDOW = HOUSE_WALLS.left.openings[0]
const WINDOW = { x: -HOUSE.halfLength, z: LEFT_WINDOW.along, halfWidth: LEFT_WINDOW.width / 2, sill: HOUSE.floorY + LEFT_WINDOW.sill, head: HOUSE.floorY + LEFT_WINDOW.head }
const [ductA, ductB, ductC] = EQUIPMENT.ductRuns

// Where each system part sits on the house at rest, before the foundation lifts it: the roof's layers in section at the
// near slope's cut, where they show one above the other; the window's pieces down its glass, so their pins stand apart.
// Working numbers, set by eye.
const SHARED_POINTS: Partial<Record<SystemPartId, Vec3>> = {
  'frame': [WINDOW.x, WINDOW.sill + 0.05, WINDOW.z + WINDOW.halfWidth - 0.05],
  'seals': [WINDOW.x, WINDOW.sill + 0.45, WINDOW.z + WINDOW.halfWidth - 0.03],
  'flashing': [WINDOW.x - 0.02, WINDOW.head + 0.04, WINDOW.z],
  'glazing': [WINDOW.x, WINDOW.sill + 0.75, WINDOW.z + 0.25],
  'pane': [WINDOW.x, WINDOW.sill + 0.35, WINDOW.z - 0.2],
  'outer-pane': [WINDOW.x, WINDOW.sill + 1.0, WINDOW.z - 0.2],
  'low-e': [WINDOW.x + 0.02, WINDOW.sill + 0.75, WINDOW.z - 0.2],
  'argon': [WINDOW.x + 0.05, WINDOW.sill + 0.5, WINDOW.z - 0.2],
  'air-gap': [WINDOW.x + 0.05, WINDOW.sill + 0.5, WINDOW.z - 0.2],
  'inner-pane': [WINDOW.x + HOUSE.wallThickness, WINDOW.sill + 0.25, WINDOW.z - 0.2],
  'condenser': [EQUIPMENT.condenser.position[0], 0.55, EQUIPMENT.condenser.position[2]],
  'refrigerant-lines': [-HOUSE.halfLength - 0.15, 0.4, EQUIPMENT.condenser.position[2] + 0.5],
  'air-handler': EQUIPMENT.plenum.position,
  'duct-runs': ductC[1],
  'jacket': ductA[1],
  'blanket': ductA[2],
  'core': ductB[1],
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
    'radiant-barrier': slopePoint(-0.6, MID_SLOPE * 1.2, -HOUSE.rafterDepth - 0.01, true),
    'attic-insulation': [-2.4, WALL_TOP_Y + 0.12, -1],
    'air-sealing': [1.2, WALL_TOP_Y + 0.02, -2.3],
    'attic-fan': ATTIC_FAN_SPOT.position,
    'package-unit': packageUnitPlacement(false, 1).position,
  },
  'low-slope': {
    'covering': [HOUSE.cutX, LOW_SLOPE_ROOF_Y, HOUSE.halfDepth / 2],
    'underlayment': [HOUSE.cutX, LOW_SLOPE_DECK_Y + HOUSE.deckThickness, HOUSE.halfDepth / 2 + 0.3],
    'deck': [HOUSE.cutX, LOW_SLOPE_DECK_Y + HOUSE.deckThickness / 2, HOUSE.halfDepth / 2 + 0.6],
    'rafters': [HOUSE.cutX, WALL_TOP_Y + LOW_SLOPE.joistSpace / 2, HOUSE.halfDepth / 2 + 1.2],
    'gutter': [HOUSE.cutX, LOW_SLOPE_ROOF_Y, -HOUSE.halfDepth],
    'attic-insulation': READING_ANCHORS['low-slope'].attic,
    'package-unit': packageUnitPlacement(true, 1).position,
  },
}

// The ceiling is lit for its story in each system, so it is pointed at where that story shows: the roof's leak coming
// through it, or, for the attic, its cut edge over the bedroom, where the gaps above it show. Working numbers, set by eye.
const CEILING_POINTS = {
  roof: [LEAK.spot[0], CEILING_Y, LEAK.spot[1]],
  attic: [-4.6, CEILING_Y, HOUSE.atticFrontZ],
} as const satisfies Partial<Record<HomeSystemId, Vec3>>

// Null for a part with no place on this roof.
export function systemPartFocus(system: HomeSystemId, form: RoofForm, id: SystemPartId): Vec3 | null {
  if (id === 'ceiling') {
    return system === 'roof' ? CEILING_POINTS.roof : CEILING_POINTS.attic
  }
  return ROOF_POINTS[form][id] ?? SHARED_POINTS[id] ?? null
}
