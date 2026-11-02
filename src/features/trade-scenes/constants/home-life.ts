import { EQUIPMENT, HOUSE, RIDGE_Y, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE, GROUND_ROWS, LOT } from '@/features/trade-scenes/constants/home-lot'
import { lotHeightAt } from '@/features/trade-scenes/lib/lot-height-at'

// Motion amounts are look numbers, tuned at the owner's look pick; each scales with the strain the readings resolve.

export const EQUIPMENT_STRAIN = {
  // Rattle of a unit running flat out, in metres and cycles a second.
  shake: { metres: 0.012, hz: 19 },
  fanTurnsPerSecond: 6,
  // The thermostat shows it is calling for air above this equipment load.
  runningAbove: 0.3,
  // Heating elements glow with the load on a winter night.
  heat: { color: '#ff8a3d', intensity: 1.8 },
  // Hot air off the condenser in the summer sun, as a soft haze that sways while the unit runs.
  shimmer: { color: '#ffcf9c', size: [0.7, 0.9] as const, strength: 0.08, swayMetres: 0.06, swayHz: 1.4 },
} as const

// A code-built fan on the condenser's louvred face (its +x before the placement turns it toward the street).
export const CONDENSER_FAN = { radius: 0.13, blades: 4, position: [0.27, 0.5, -0.06] as const, rotationY: Math.PI / 2, blade: '#3b3a38', hub: '#5f5b56' } as const

export const METER_DIAL = { turnsPerSecond: 1.8, radius: 0.07 } as const

export const CEILING_FAN_TURNS_PER_SECOND = 1.3

export const THERMOSTAT_DISPLAY = {
  // The lit face, [width, height], and the running mark in its corner.
  face: [0.07, 0.044],
  markRadius: 0.006,
  // Canvas pixels for the face's text; the face itself is 8 × 5 cm.
  pixels: [128, 80] as const,
  text: '#e9f1f4',
  running: { summer: '#7cc4ff', winter: '#ff9f5a' },
  pulseHz: 1.2,
} as const

const LIVING_CEILING_Y = WALL_TOP_Y - HOUSE.ceilingThickness

// Where the rain walk reaches the room: over the living room, clear of the fan and the sofa, under the kept ceiling.
export const LEAK = {
  spot: [1.35, -0.8] as const,
  ceilingY: LIVING_CEILING_Y,
  floorY: HOUSE.floorY,
  // A full leak (reachesInside 1) stains this wide; the walk's share scales it down.
  stainRadius: 1.2,
  stain: { rim: '#5a4630', fill: '#8a734f' },
  // The water stands at waterLine of the pail's height.
  bucket: { radiusTop: 0.16, radiusBottom: 0.13, height: 0.26, color: '#7f98a8', water: '#9fb9c9', waterLine: 0.6 },
  // Each drop gathers on the ceiling for `gather` of its period, then falls under gravity.
  drip: { radius: 0.018, color: '#a9c8dc', periodSeconds: 1.1, gather: 0.45 },
} as const

// Rain fills the sky over the whole lot but reaches the ground only around the house: a streak falling into the cut-open
// rooms would read as rain indoors. The sky band starts just over the ridge. It stops at the lot's walls, so no streak falls
// through a neighbour.
const SKY_FLOOR = RIDGE_Y + 0.3
const SKY_TOP = 11
const CLEAR = { minX: -HOUSE.halfLength - 0.7, maxX: HOUSE.halfLength + 0.7, minZ: -HOUSE.halfDepth - 0.8, maxZ: HOUSE.halfDepth + 0.8 }
// The garage beside it keeps a clear zone of its own, so no streak falls through its roof. Flush with the house front, it
// shares the house's front edge.
const GARAGE_CLEAR = { maxX: GARAGE.x1 + 0.8, minZ: GARAGE.z0 - 0.8 }

// The front lawn falls to the sidewalk, so a field reaching the ground runs down to its lowest grade: its streaks end under
// the lawn, never in mid-air over the slope.
function lowestGround(minZ: number, maxZ: number): number {
  const inside = GROUND_ROWS.filter(([z]) => z > minZ && z < maxZ).map(([, y]) => y)
  return Math.min(lotHeightAt(minZ), lotHeightAt(maxZ), ...inside)
}

function field(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) {
  return {
    box: [maxX - minX, maxY - minY, maxZ - minZ] as const,
    position: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2] as const,
  }
}

export const HOME_RAIN = {
  // Streaks per cubic metre, so every field rains equally hard whatever its size.
  density: 0.16,
  fields: [
    field(LOT.left, LOT.right, SKY_FLOOR, SKY_TOP, LOT.back, LOT.front),
    field(LOT.left, LOT.right, lowestGround(CLEAR.maxZ, LOT.front), SKY_FLOOR, CLEAR.maxZ, LOT.front),
    field(LOT.left, LOT.right, lowestGround(LOT.back, CLEAR.minZ), SKY_FLOOR, LOT.back, CLEAR.minZ),
    field(LOT.left, CLEAR.minX, lowestGround(CLEAR.minZ, CLEAR.maxZ), SKY_FLOOR, CLEAR.minZ, CLEAR.maxZ),
    field(CLEAR.maxX, LOT.right, lowestGround(CLEAR.minZ, GARAGE_CLEAR.minZ), SKY_FLOOR, CLEAR.minZ, GARAGE_CLEAR.minZ),
    field(GARAGE_CLEAR.maxX, LOT.right, lowestGround(GARAGE_CLEAR.minZ, CLEAR.maxZ), SKY_FLOOR, GARAGE_CLEAR.minZ, CLEAR.maxZ),
  ],
  // Water out of each downspout's foot, as a short stream.
  spout: { box: [0.08, 0.5, 0.08] as const, intensity: 0.06 },
} as const

export const CONDENSER_SHIMMER_POSITION = [EQUIPMENT.condenser.position[0], 1.05, EQUIPMENT.condenser.position[2] + 0.3] as const
