import type { IndoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'
import type { HvacIndoorLocation } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { CONDENSER_LINE_SET, LOW_SLOPE_DUCTS } from '@/features/trade-scenes/constants/home-details'
import { EQUIPMENT, HOME_FLOOR_Y, HOUSE, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'

const [PLENUM_X, PLENUM_Y, PLENUM_Z] = EQUIPMENT.plenum.position
const CEILING_Y = WALL_TOP_Y - HOUSE.ceilingThickness

// Each line set ends on the left wall's outside over the condenser's own lines; the drop to them follows the floor. A run
// along the outside stands where a slab house meets them.
const LINE_OUT = CONDENSER_LINE_SET.size / 2
const LINE_Z = EQUIPMENT.condenser.position[2] + CONDENSER_LINE_SET.z
const LINE_RUN_Y = CONDENSER_LINE_SET.y - (HOME_FLOOR_Y.slab - HOUSE.floorY)
const LEFT_FACE = -HOUSE.halfLength - LINE_OUT

// Working numbers, set by screenshot. In the attic the line lies along the floor from the return at the attic's cut to the
// plenum at today's plenum spot, entering from the front, the one face no run leaves from.
const ATTIC_SECTION = [0.68, 0.43] as const
const ATTIC_LENGTHS = { blower: 0.42, furnace: 0.38, coil: 0.32, plenum: EQUIPMENT.plenum.size[2] } as const
const ATTIC_BASE_Z = PLENUM_Z + ATTIC_LENGTHS.blower + ATTIC_LENGTHS.furnace + ATTIC_LENGTHS.coil + ATTIC_LENGTHS.plenum / 2
const ATTIC_COIL_Z = ATTIC_BASE_Z - ATTIC_LENGTHS.blower - ATTIC_LENGTHS.furnace - ATTIC_LENGTHS.coil / 2

// A ceiling return wider than any supply grille, in the living room beside the cabinet's return end and behind the ceiling's
// cut, clear of the supply grilles; its duct climbs out of the blanket and comes into the blower's side at the return end.
// Working numbers, set by screenshot.
const RETURN_GRILLE = { size: [0.7, 0.012, 0.45] as Vec3, x: PLENUM_X - 0.65, z: -0.32 } as const
const RETURN_INTO_BLOWER_Z = ATTIC_BASE_Z - 0.12
const ATTIC_RETURN: IndoorUnitPlacement['returnAir'] = {
  grille: { size: RETURN_GRILLE.size, position: [RETURN_GRILLE.x, CEILING_Y - RETURN_GRILLE.size[1] / 2, RETURN_GRILLE.z] },
  facing: [0, -1, 0],
  duct: [
    [RETURN_GRILLE.x, WALL_TOP_Y, RETURN_GRILLE.z],
    [RETURN_GRILLE.x, WALL_TOP_Y + 0.25, RETURN_GRILLE.z],
  ],
  intoBlower: [
    [PLENUM_X - ATTIC_SECTION[0] / 2 - 0.16, PLENUM_Y, RETURN_INTO_BLOWER_Z],
    [PLENUM_X - ATTIC_SECTION[0] / 2, PLENUM_Y, RETURN_INTO_BLOWER_Z],
  ],
}

// From the coil's side the lines rise over the runs leaving the plenum's left face, cross the attic to the gable, and come
// down the left wall's outside to meet the condenser's. Working numbers, set by screenshot.
const ATTIC: IndoorUnitPlacement = {
  upright: false,
  base: [PLENUM_X, PLENUM_Y, ATTIC_BASE_Z],
  toward: [0, 0, -1],
  // The runs leave from today's plenum spot, so a unit short a section keeps its plenum there and closes up toward the return.
  anchor: 'plenum',
  section: ATTIC_SECTION,
  lengths: ATTIC_LENGTHS,
  lineSet: [
    [PLENUM_X - ATTIC_SECTION[0] / 2 - 0.16, WALL_TOP_Y + 0.45, ATTIC_COIL_Z],
    [-1.5, WALL_TOP_Y + 0.72, ATTIC_COIL_Z],
    [-4.5, WALL_TOP_Y + 0.72, ATTIC_COIL_Z],
    [-HOUSE.halfLength + 0.3, WALL_TOP_Y + 0.6, LINE_Z],
    [LEFT_FACE, WALL_TOP_Y + 0.6, LINE_Z],
  ],
  closet: [],
  trunk: [EQUIPMENT.plenum.position],
  returnAir: ATTIC_RETURN,
}

// Working numbers, set by screenshot. The closet stands in the bedroom against the left wall, between the wall's low heat
// lane and its window's, with the condenser just outside: clear of every arrow, the bed and the window. It opens toward the
// front, where the rooms are seen from, its bifold door folded back against the jamb away from the wall.
const CLOSET_WALL = HOUSE.partitionThickness
const LEFT_INNER = -HOUSE.halfLength + HOUSE.wallThickness
const CLOSET_SPAN = { back: -1.02, front: -0.27 } as const
const CLOSET_DEPTH = 0.85
const CLOSET_INSIDE = { back: CLOSET_SPAN.back + CLOSET_WALL, front: CLOSET_SPAN.front - CLOSET_WALL, side: LEFT_INNER + CLOSET_DEPTH } as const
const CLOSET_HEADER_Y = HOUSE.floorY + 2.05
const CLOSET_FULL_HEIGHT = CEILING_Y - HOUSE.floorY
const CLOSET_MID_Y = (HOUSE.floorY + CEILING_Y) / 2
const BIFOLD = { thickness: 0.12, reach: 0.22, height: 2.0 } as const
const CLOSET_OUTER_X = CLOSET_INSIDE.side + CLOSET_WALL

const CLOSET_WALLS: readonly BoxSpec[] = [
  { size: [CLOSET_OUTER_X - LEFT_INNER, CLOSET_FULL_HEIGHT, CLOSET_WALL], position: [(LEFT_INNER + CLOSET_OUTER_X) / 2, CLOSET_MID_Y, CLOSET_SPAN.back + CLOSET_WALL / 2] },
  { size: [CLOSET_WALL, CLOSET_FULL_HEIGHT, CLOSET_SPAN.front - CLOSET_SPAN.back], position: [CLOSET_INSIDE.side + CLOSET_WALL / 2, CLOSET_MID_Y, (CLOSET_SPAN.back + CLOSET_SPAN.front) / 2] },
  { size: [CLOSET_INSIDE.side - LEFT_INNER, CEILING_Y - CLOSET_HEADER_Y, CLOSET_WALL], position: [(LEFT_INNER + CLOSET_INSIDE.side) / 2, (CLOSET_HEADER_Y + CEILING_Y) / 2, CLOSET_INSIDE.front + CLOSET_WALL / 2] },
  { size: [BIFOLD.thickness, BIFOLD.height, BIFOLD.reach], position: [CLOSET_INSIDE.side - BIFOLD.thickness / 2, HOUSE.floorY + BIFOLD.height / 2, CLOSET_SPAN.front + BIFOLD.reach / 2 - CLOSET_WALL] },
]

// The upright unit stands toward the left wall, leaving room behind it for the lines, its plenum through the ceiling into
// the attic or the joist space.
const CLOSET_SECTION = [0.62, 0.5] as const
const CLOSET_X = LEFT_INNER + 0.12 + CLOSET_SECTION[0] / 2
const CLOSET_Z = (CLOSET_INSIDE.back + CLOSET_INSIDE.front) / 2
const PLENUM_RISE = 0.1
const CLOSET_CABINET = { blower: 0.55, furnace: 0.7, coil: 0.55 } as const
const CLOSET_LENGTHS = { ...CLOSET_CABINET, plenum: WALL_TOP_Y + PLENUM_RISE - HOUSE.floorY - CLOSET_CABINET.blower - CLOSET_CABINET.furnace - CLOSET_CABINET.coil }
const CLOSET_COIL_Y = HOUSE.floorY + CLOSET_CABINET.blower + CLOSET_CABINET.furnace + CLOSET_CABINET.coil / 2

// Out through the wall behind the coil, down the left wall's outside, and along it to the condenser's lines.
const CLOSET_LINE_SET: readonly Vec3[] = [
  [LEFT_INNER + 0.05, CLOSET_COIL_Y, CLOSET_Z],
  [LEFT_FACE, CLOSET_COIL_Y, CLOSET_Z],
  [LEFT_FACE, LINE_RUN_Y, CLOSET_Z],
  [LEFT_FACE, LINE_RUN_Y, LINE_Z],
]

// The air comes in low through the closet's side wall, at the blower in the bottom of the upright unit. Working numbers, set
// by screenshot.
const CLOSET_RETURN_GRILLE: Vec3 = [0.012, 0.35, 0.5]
const CLOSET_RETURN: IndoorUnitPlacement['returnAir'] = {
  grille: { size: CLOSET_RETURN_GRILLE, position: [CLOSET_OUTER_X + CLOSET_RETURN_GRILLE[0] / 2, HOUSE.floorY + CLOSET_CABINET.blower / 2, CLOSET_Z] },
  facing: [1, 0, 0],
  duct: [],
  intoBlower: [],
}

function closet(trunk: readonly Vec3[]): IndoorUnitPlacement {
  return {
    upright: true,
    base: [CLOSET_X, HOUSE.floorY, CLOSET_Z],
    toward: [0, 1, 0],
    anchor: 'return',
    section: CLOSET_SECTION,
    lengths: CLOSET_LENGTHS,
    lineSet: CLOSET_LINE_SET,
    closet: CLOSET_WALLS,
    trunk,
    returnAir: CLOSET_RETURN,
  }
}

// Working numbers, set by screenshot. Out of the plenum's top the trunk turns back behind the bedroom's run, clear of the
// bedroom's can, and comes into today's plenum spot from behind, the face no run leaves from. Under a flat roof it keeps to
// the joist space and joins the runs where they start today.
const LOW_SLOPE_RUN_Y = EQUIPMENT.ductRuns.reduce((sum, run) => sum + run[0][1], 0) / EQUIPMENT.ductRuns.length - LOW_SLOPE_DUCTS.drop
const TRUNK_BEHIND_Z = -2.05
const CLOSET_PITCHED = closet([
  [CLOSET_X, WALL_TOP_Y + 0.2, CLOSET_Z - 0.55],
  [-4.9, WALL_TOP_Y + 0.28, -1.75],
  [-1.3, WALL_TOP_Y + 0.33, TRUNK_BEHIND_Z],
  [PLENUM_X, WALL_TOP_Y + 0.36, TRUNK_BEHIND_Z],
  EQUIPMENT.plenum.position,
])
const CLOSET_LOW_SLOPE = closet([
  [CLOSET_X, WALL_TOP_Y + 0.13, CLOSET_Z - 0.55],
  [-4.9, WALL_TOP_Y + 0.14, -1.75],
  [-1.3, LOW_SLOPE_RUN_Y, TRUNK_BEHIND_Z],
  [PLENUM_X, LOW_SLOPE_RUN_Y, TRUNK_BEHIND_Z],
  [PLENUM_X, LOW_SLOPE_RUN_Y, PLENUM_Z],
])

// A flat roof's joist space holds no unit, so nothing reads the attic's low-slope entry; it carries the pitched one.
export const INDOOR_UNIT_PLACEMENTS: Readonly<Partial<Record<HvacIndoorLocation, Readonly<Record<RoofForm, IndoorUnitPlacement>>>>> = {
  attic: { 'pitched': ATTIC, 'low-slope': ATTIC },
  closet: { 'pitched': CLOSET_PITCHED, 'low-slope': CLOSET_LOW_SLOPE },
}

// Where a closet's trunk meets the runs, a box they leave from: today's plenum box in the attic, and as deep as the runs
// themselves in a flat roof's joist space. Working numbers, set by screenshot.
export const SUPPLY_JUNCTION: Readonly<Record<RoofForm, Vec3>> = {
  'pitched': EQUIPMENT.plenum.size,
  'low-slope': [EQUIPMENT.plenum.size[0], 0.2, EQUIPMENT.plenum.size[2]],
}

// Working numbers, set by screenshot: the gap that shows between two sections, the supply trunk's radius, the return duct's,
// and the line set's.
export const INDOOR_UNIT_LOOK = { seam: 0.012, trunkRadius: 0.09, returnRadius: 0.12, lineRadius: CONDENSER_LINE_SET.size / 2 } as const
