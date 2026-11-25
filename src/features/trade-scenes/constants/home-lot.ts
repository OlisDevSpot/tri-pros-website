import { HOME_FLOOR_Y, HOUSE, RIDGE_Y } from '@/features/trade-scenes/constants/home-geometry'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'

// Metres. Every figure here is a hand-tuned working number for a typical SoCal tract lot.
const SETBACK_FRONT = 6.1
const SIDE_YARD = 1.52

// A two-car garage flush with the house front: 6.1 m clear inside, plus its walls.
export const GARAGE = {
  x0: HOUSE.halfLength,
  x1: HOUSE.halfLength + 6.4,
  z0: HOUSE.halfDepth - 6.6,
  z1: HOUSE.halfDepth,
  wallTop: HOME_FLOOR_Y.slab + HOUSE.wallHeight,
  // A flat garage steps a touch above the house's parapet.
  flatTop: HOME_FLOOR_Y.slab + HOUSE.wallHeight + 0.62,
  door: { width: 4.88, height: 2.13 },
}

export const LOT = {
  // The left side yard holds the condenser, so it is wider than the 5 ft minimum.
  left: -HOUSE.halfLength - 2.5,
  right: GARAGE.x1 + SIDE_YARD,
  front: HOUSE.halfDepth + SETBACK_FRONT,
  back: HOUSE.halfDepth + SETBACK_FRONT - 33.5,
  wall: { height: 1.83, thickness: 0.15, capHeight: 0.05, capWidth: 0.2 },
  frontFence: 1.07,
  // The side-yard gates stand just behind the front corners, so the condenser and the meter stay inside the side yard.
  gateZ: HOUSE.halfDepth - 0.6,
}

export const STREET_BAND = { sidewalk: 1.52, parkway: 2.13, street: 11.0 } as const
const CURB_Z = LOT.front + STREET_BAND.sidewalk + STREET_BAND.parkway
export const STREET_Z = {
  sidewalk: [LOT.front, LOT.front + STREET_BAND.sidewalk] as const,
  curb: CURB_Z,
  farCurb: CURB_Z + STREET_BAND.street,
  farSidewalk: [CURB_Z + STREET_BAND.street + STREET_BAND.parkway, CURB_Z + STREET_BAND.street + STREET_BAND.parkway + STREET_BAND.sidewalk] as const,
}

// The house pad sits above the street: flat round the house, the front yard falling to the sidewalk, then the curb's step.
export const GRADE = {
  padEnd: HOUSE.halfDepth + 1.6,
  walk: -0.45,
  street: -0.6,
  curb: 0.15,
}

export const WALK = { x0: -1.25, x1: 0.05 }

export const MULCH_BEDS: readonly { x0: number, x1: number, z0: number, z1: number }[] = [
  { x0: -3.75 - 2.3, x1: -3.75 + 2.3, z0: HOUSE.halfDepth + 0.85 - 0.65, z1: HOUSE.halfDepth + 0.85 + 0.65 },
  { x0: 2.6 - 2.2, x1: 2.6 + 2.2, z0: HOUSE.halfDepth + 0.85 - 0.65, z1: HOUSE.halfDepth + 0.85 + 0.65 },
  { x0: LOT.left + 0.85 - 0.75, x1: LOT.left + 0.85 + 0.75, z0: LOT.gateZ, z1: GRADE.padEnd },
]

// The houses across the street sit on a pad of their own, the same rise up from their sidewalk.
export const FAR_RISE = 4.5

// The ground's cross-section along z; x runs flat. It steps down to the street just behind each curb's face, so the
// curb hides the step.
export const GROUND_ROWS: readonly (readonly [z: number, y: number])[] = [
  [-140, 0],
  [GRADE.padEnd, 0],
  [LOT.front, GRADE.walk],
  [STREET_Z.curb + GRADE.curb - 0.01, GRADE.walk],
  [STREET_Z.curb + GRADE.curb, GRADE.street],
  [STREET_Z.farCurb - GRADE.curb, GRADE.street],
  [STREET_Z.farCurb - GRADE.curb + 0.01, GRADE.walk],
  [STREET_Z.farSidewalk[1], GRADE.walk],
  [STREET_Z.farSidewalk[1] + FAR_RISE, 0],
  [140, 0],
]

// The box the sun's shadow camera must cover: the whole lot, up to the raised house's ridge.
export const LOT_SHADOW_BOX = {
  min: [LOT.left, GRADE.walk, LOT.back],
  max: [LOT.right, RIDGE_Y + homeLift('raised') + 1, LOT.front],
} as const

// The lot's own materials, beside the house palette's paving and block wall. Physical colours under scene light, tuned by eye.
export const LOT_PALETTE = {
  asphalt: '#59585b',
  joint: '#a8a093',
  mulch: '#4a3626',
  wallCap: '#c4b597',
  fenceBoard: '#a9693e',
  fenceRail: '#8f5832',
  vinyl: '#f2f1ec',
  compositeBoard: '#6e6257',
  compositePost: '#2f2b28',
  iron: '#2a2a2c',
  galvanised: '#9ea3a6',
  chainMesh: '#b7bcbf',
  dryGrass: '#a59a5c',
  bareSoil: '#7d6247',
  stain: '#5c564d',
  crack: '#3a3733',
  fade: '#b5ad9e',
} as const
