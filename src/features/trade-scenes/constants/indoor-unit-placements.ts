import type { IndoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'
import type { HvacIndoorLocation } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { CONDENSER_LINE_SET, LOW_SLOPE_DUCTS } from '@/features/trade-scenes/constants/home-details'
import { BACK_INNER, EQUIPMENT, HOME_FLOOR_Y, HOUSE, PARTITIONS_X, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'

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

// From the coil's side the lines rise over the runs leaving the plenum's left face, cross the attic to the gable, and come
// down the left wall's outside to meet the condenser's. Working numbers, set by screenshot.
const ATTIC: IndoorUnitPlacement = {
  upright: false,
  base: [PLENUM_X, PLENUM_Y, ATTIC_BASE_Z],
  toward: [0, 0, -1],
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
}

// Working numbers, set by screenshot. The closet stands against the back wall on the living room's side of the kitchen
// partition, which is its right wall, between the sofa and the partition. Its door stands open against the partition.
const CLOSET_WALL = HOUSE.partitionThickness
const CLOSET_RIGHT = PARTITIONS_X[1] - HOUSE.partitionThickness / 2
const CLOSET_INSIDE = { width: 0.7, depth: 0.9 } as const
const CLOSET_LEFT = CLOSET_RIGHT - CLOSET_INSIDE.width
const CLOSET_FRONT = BACK_INNER + CLOSET_INSIDE.depth
const CLOSET_DOOR = { width: 0.63, height: 2.05, leaf: 0.035, clear: 0.002 } as const
const CLOSET_DOOR_LEFT = CLOSET_RIGHT - CLOSET_DOOR.width
const CLOSET_HEADER_Y = HOUSE.floorY + CLOSET_DOOR.height
const CLOSET_DEPTH_OVERALL = CLOSET_INSIDE.depth + CLOSET_WALL

const CLOSET_WALLS: readonly BoxSpec[] = [
  {
    size: [CLOSET_WALL, CEILING_Y - HOUSE.floorY, CLOSET_DEPTH_OVERALL],
    position: [CLOSET_LEFT - CLOSET_WALL / 2, (HOUSE.floorY + CEILING_Y) / 2, BACK_INNER + CLOSET_DEPTH_OVERALL / 2],
  },
  {
    size: [CLOSET_DOOR_LEFT - CLOSET_LEFT, CEILING_Y - HOUSE.floorY, CLOSET_WALL],
    position: [(CLOSET_LEFT + CLOSET_DOOR_LEFT) / 2, (HOUSE.floorY + CEILING_Y) / 2, CLOSET_FRONT + CLOSET_WALL / 2],
  },
  {
    size: [CLOSET_DOOR.width, CEILING_Y - CLOSET_HEADER_Y, CLOSET_WALL],
    position: [CLOSET_DOOR_LEFT + CLOSET_DOOR.width / 2, (CLOSET_HEADER_Y + CEILING_Y) / 2, CLOSET_FRONT + CLOSET_WALL / 2],
  },
  {
    size: [CLOSET_DOOR.leaf, CLOSET_DOOR.height - 0.02, CLOSET_DOOR.width - 0.01],
    position: [CLOSET_RIGHT - CLOSET_DOOR.clear - CLOSET_DOOR.leaf / 2, HOUSE.floorY + (CLOSET_DOOR.height - 0.02) / 2, CLOSET_FRONT + CLOSET_WALL + (CLOSET_DOOR.width - 0.01) / 2],
  },
]

// The upright unit stands toward the back of the closet, its plenum through the ceiling into the attic or the joist space.
const CLOSET_SECTION = [0.55, 0.62] as const
const CLOSET_X = (CLOSET_LEFT + CLOSET_RIGHT) / 2
const CLOSET_Z = BACK_INNER + 0.18 + CLOSET_SECTION[1] / 2
const PLENUM_RISE = 0.1
const CLOSET_CABINET = { blower: 0.55, furnace: 0.7, coil: 0.55 } as const
const CLOSET_LENGTHS = { ...CLOSET_CABINET, plenum: WALL_TOP_Y + PLENUM_RISE - HOUSE.floorY - CLOSET_CABINET.blower - CLOSET_CABINET.furnace - CLOSET_CABINET.coil }
const CLOSET_COIL_Y = HOUSE.floorY + CLOSET_CABINET.blower + CLOSET_CABINET.furnace + CLOSET_CABINET.coil / 2

// Out through the wall behind the coil, down the back wall's outside, round the back corner and along the left wall to the
// condenser's lines.
const CLOSET_LINE_X = CLOSET_X + 0.2
const BACK_FACE = -HOUSE.halfDepth - LINE_OUT
const CLOSET_LINE_SET: readonly Vec3[] = [
  [CLOSET_LINE_X, CLOSET_COIL_Y, BACK_INNER + 0.04],
  [CLOSET_LINE_X, CLOSET_COIL_Y, BACK_FACE],
  [CLOSET_LINE_X, LINE_RUN_Y, BACK_FACE],
  [LEFT_FACE, LINE_RUN_Y, BACK_FACE],
  [LEFT_FACE, LINE_RUN_Y, LINE_Z],
]

function closet(trunk: readonly Vec3[]): IndoorUnitPlacement {
  return {
    upright: true,
    base: [CLOSET_X, HOUSE.floorY, CLOSET_Z],
    toward: [0, 1, 0],
    section: CLOSET_SECTION,
    lengths: CLOSET_LENGTHS,
    lineSet: CLOSET_LINE_SET,
    closet: CLOSET_WALLS,
    trunk,
  }
}

// Working numbers, set by screenshot. Out of the plenum's top the trunk turns toward the room, clear of the rafters low over
// the back wall, crosses behind the runs to the right and comes into today's plenum spot from behind. Under a flat roof it
// stays in the joist space and joins the runs where they start today.
const LOW_SLOPE_RUN_Y = EQUIPMENT.ductRuns.reduce((sum, run) => sum + run[0][1], 0) / EQUIPMENT.ductRuns.length - LOW_SLOPE_DUCTS.drop
const CLOSET_PITCHED = closet([
  [CLOSET_X, WALL_TOP_Y + 0.12, CLOSET_Z + 0.35],
  [1.6, WALL_TOP_Y + 0.16, -2.75],
  [PLENUM_X, WALL_TOP_Y + 0.3, -2.6],
  EQUIPMENT.plenum.position,
])
const CLOSET_LOW_SLOPE = closet([
  [CLOSET_X, WALL_TOP_Y + 0.12, CLOSET_Z + 0.35],
  [1.6, WALL_TOP_Y + 0.14, -2.75],
  [PLENUM_X, LOW_SLOPE_RUN_Y, -2.45],
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

// Working numbers, set by screenshot: the gap that shows between two sections, the supply trunk's radius, and the line set's.
export const INDOOR_UNIT_LOOK = { seam: 0.012, trunkRadius: 0.09, lineRadius: CONDENSER_LINE_SET.size / 2 } as const
