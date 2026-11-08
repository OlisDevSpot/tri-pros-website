import type { CompleteRoofLane, CompleteWallLane, CutawayFaceSystemId, HeatLaneFlows, HouseWall, RoofHeatLane, Vec3, WallHeatLane } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { COVERING_BASE, FRONT_WALL, GABLE_VENT_Y, HOUSE, HOUSE_WALLS, RADIANT_BARRIER_FACES, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { coveringBaseY } from '@/features/trade-scenes/lib/covering-base-y'
import { GARAGE_BOXES } from '@/features/trade-scenes/lib/garage-boxes'

const add = (point: Vec3, by: Vec3): Vec3 => [point[0] + by[0], point[1] + by[1], point[2] + by[2]]

// Working numbers, tuned at the owner's review. The roof lanes come down through the back slope where the near slope is
// cut away, between the attic pin and the roof's own pin, so every arrow lands on roof the opening shows from inside; they
// meet the ceiling at its cut edge, where the insulation shows its depth, and carry on into the room in front of it.
const ROOF_LANE_XS = [0.5, 1.2, 1.9] as const
// A flat roof sits just over its ceiling, so its lanes cross it further back: the longer slant down to the cut edge keeps
// the arrows on it apart.
const ROOF_LANE_Z: Record<RoofForm, number> = { 'pitched': -0.8, 'low-slope': -1.9 }
const SKY_ABOVE = 2.6
const ATTIC_FLOOR: { y: number, z: number } = { y: WALL_TOP_Y + 0.1, z: HOUSE.atticFrontZ - 0.25 }
const ROOM: { y: number, z: number } = { y: HOUSE.floorY + 1.1, z: 1.1 }
// Tri Pros staples the foil across the rafters' undersides from inside the attic, so its share turns back from there, a
// rafter's depth under the deck: plumb below the covering's base by the slope's run between their faces. A flat roof never
// takes one (it is worked from inside an attic), so its point only keeps the lane's shape.
const BARRIER_BELOW_COVERING: Record<RoofForm, number> = {
  'pitched': (COVERING_BASE - RADIANT_BARRIER_FACES[0]) / Math.cos(HOUSE.pitch),
  'low-slope': COVERING_BASE - RADIANT_BARRIER_FACES[0],
}
// Sunlight a cool covering turns back leaves up and away off the slope; the barrier sends its share back up at the deck.
const COVERING_BOUNCE: Vec3 = [0.3, 1.3, -0.9]
const BARRIER_BOUNCE: Vec3 = [-0.3, 0.75, -0.5]

function roofLane(x: number, form: RoofForm): RoofHeatLane {
  const z = ROOF_LANE_Z[form]
  const y = coveringBaseY(z, form)
  const covering: Vec3 = [x, y, z]
  const barrier: Vec3 = [x, y - BARRIER_BELOW_COVERING[form], z]
  return {
    sky: [x, y + SKY_ABOVE, z],
    covering,
    atticFloor: [x, ATTIC_FLOOR.y, ATTIC_FLOOR.z],
    room: [x, ROOM.y, ROOM.z],
    coveringBounceTo: add(covering, COVERING_BOUNCE),
    barrier,
    barrierBounceTo: add(barrier, BARRIER_BOUNCE),
  }
}

// The home's fixed roof lanes in world metres, drawn as for summer, outside in.
export const HOME_ROOF_HEAT_LANES: Record<RoofForm, readonly RoofHeatLane[]> = {
  'pitched': ROOF_LANE_XS.map(x => roofLane(x, 'pitched')),
  'low-slope': ROOF_LANE_XS.map(x => roofLane(x, 'low-slope')),
}

// Outside legs stop this far off the face they strike, so the Complete house hides no arrowhead in itself. A working
// number, tuned by eye.
export const LANE_STANDOFF = 0.05

// Working numbers, tuned at the owner's review. How far above the covering's base a roof lane stops: shingles and shakes
// lie nearly flat, but a barrel tile's caps stand well proud, and an arrow ending under their crowns would be buried.
export const COVERING_STANDOFF: Readonly<Record<string, number>> = { 'wood-shake': 0.08, 'tile': 0.2 }
export const DEFAULT_COVERING_STANDOFF = 0.06

// From the yard the sun lands on the gable's near slope, so its lanes are the back slope's mirrored across the ridge. The
// flat roof's membrane is in sight already, so its lanes stay where they are.
const NEAR_SLOPE_Z = -ROOF_LANE_Z.pitched
// Working numbers, tuned by eye.
const NEAR_SLOPE_BOUNCE: Vec3 = [0.3, 1.3, 0.9]

function nearSlopeLane(x: number): CompleteRoofLane {
  const y = coveringBaseY(NEAR_SLOPE_Z, 'pitched')
  const covering: Vec3 = [x, y, NEAR_SLOPE_Z]
  return { sky: [x, y + SKY_ABOVE, NEAR_SLOPE_Z], covering, coveringBounceTo: add(covering, NEAR_SLOPE_BOUNCE) }
}

// The Complete house's roof lanes in world metres, drawn as for summer, outside in. The covering point is the pitched
// covering's base, or the flat roof's membrane top; the builder stands the lane off it by the covering laid there.
export const HOME_COMPLETE_ROOF_HEAT_LANES: Record<RoofForm, readonly CompleteRoofLane[]> = {
  'pitched': ROOF_LANE_XS.map(nearSlopeLane),
  'low-slope': HOME_ROOF_HEAT_LANES['low-slope'].map(({ sky, covering, coveringBounceTo }) => ({ sky, covering, coveringBounceTo })),
}

// Working numbers, tuned by eye. The wall lanes run low on the stucco, two to a wall, along its run: clear of
// its windows, of the front door and the steps up to it, and on the sunny left wall of the meter at the front.
const WALL_LANE_Y = HOUSE.floorY + 0.65
const WALL_LANE_ALONGS = { back: [-1.05, 1.9], left: [-1.3, -3], right: [-1.3, -3], front: [-1.6, 3] } as const
const LANE_WALLS = { ...HOUSE_WALLS, front: FRONT_WALL } as const

// A working number, tuned by eye. The open house's wall and window lanes reach this far out into the yard and in into the
// rooms from the wall's centre line: any shorter and a window's four arrows on its outside leg would crowd together.
export const OPEN_LANE_REACH = 1.3

// A working number, tuned at the owner's review. The Complete house's wall lanes start this far out in the yard: starting a
// hand's width off the wall, they would be a flickering clump of arrows.
const COMPLETE_WALL_LANE_REACH = 1.2

// Working numbers, tuned by eye. Sun a face turns back leaves it out into the yard, up, and a little along the wall, in the
// wall's own terms so every wall turns it back off its own outside.
const FACE_BOUNCE_OFFSET = { out: 0.8, up: 0.9, along: 0.3 } as const

const FACE_OUT = HOUSE.wallThickness / 2 + LANE_STANDOFF

// A point on a wall's lane, `out` metres from its centre line toward the outside, placed as the wall's boxes are.
export function wallPoint(wall: HouseWall, along: number, y: number, out: number): Vec3 {
  const across = wall.line + wall.outward * out
  return wall.run === 'x' ? [along, y, across] : [across, y, along]
}

// Where the sun a face turns back at `along`, `y` goes: out off its outside into the yard, whatever depth it turned at.
export function faceBounceTo(wall: HouseWall, along: number, y: number): Vec3 {
  return wallPoint(wall, along + FACE_BOUNCE_OFFSET.along, y + FACE_BOUNCE_OFFSET.up, FACE_OUT + FACE_BOUNCE_OFFSET.out)
}

function wallHeatLane(wall: HouseWall, along: number, y: number): WallHeatLane {
  return {
    outside: wallPoint(wall, along, y, OPEN_LANE_REACH),
    face: wallPoint(wall, along, y, FACE_OUT),
    inside: wallPoint(wall, along, y, -OPEN_LANE_REACH),
    bounceTo: faceBounceTo(wall, along, y),
  }
}

function completeWallLane(wall: HouseWall, along: number, y: number): CompleteWallLane {
  return {
    outside: wallPoint(wall, along, y, HOUSE.wallThickness / 2 + COMPLETE_WALL_LANE_REACH),
    face: wallPoint(wall, along, y, FACE_OUT),
    bounceTo: faceBounceTo(wall, along, y),
  }
}

// The garage stands against the right wall, and Partly open draws its lanes through anything in front of them: a lane on
// the wall under the garage, its eaves included, would come out of the garage. The fascia closes each eave, so the walls,
// the trim and the fascia of either roof form mark how far the garage reaches along the wall.
const GARAGE_REACH = (() => {
  const ends = Object.values(GARAGE_BOXES)
    .flatMap(boxes => [...boxes.body, ...boxes.trim, ...boxes.fascia])
    .flatMap(({ size, position }) => [position[2] - size[2] / 2, position[2] + size[2] / 2])
  return { from: Math.min(...ends), to: Math.max(...ends) }
})()

function underGarage(wall: HouseWall, along: number): boolean {
  return wall === HOUSE_WALLS.right && along > GARAGE_REACH.from && along < GARAGE_REACH.to
}

function wallLanes<Lane>(walls: readonly (keyof typeof LANE_WALLS)[], lane: (wall: HouseWall, along: number, y: number) => Lane): Lane[] {
  return walls.flatMap(id => WALL_LANE_ALONGS[id]
    .filter(along => !underGarage(LANE_WALLS[id], along))
    .map(along => lane(LANE_WALLS[id], along, WALL_LANE_Y)))
}

// Read off the house's own walls, so a moved opening moves its arrows.
function windowLanes<Lane>(walls: readonly HouseWall[], lane: (wall: HouseWall, along: number, y: number) => Lane): Lane[] {
  return walls.flatMap(wall => wall.openings
    .filter(opening => !underGarage(wall, opening.along))
    .map(opening => lane(wall, opening.along, HOUSE.floorY + (opening.sill + opening.head) / 2)))
}

// The walls' and the windows' fixed lanes in world metres, drawn as for summer, outside in. Partly open cuts the front wall
// away, so only the Complete house has lanes on it.
export const HOME_WALL_HEAT_LANES: readonly WallHeatLane[] = wallLanes(['back', 'left', 'right'], wallHeatLane)
export const HOME_COMPLETE_WALL_HEAT_LANES: readonly CompleteWallLane[] = wallLanes(['back', 'left', 'right', 'front'], completeWallLane)
export const HOME_WINDOW_HEAT_LANES: readonly WallHeatLane[] = windowLanes(Object.values(HOUSE_WALLS), wallHeatLane)
export const HOME_COMPLETE_WINDOW_HEAT_LANES: readonly CompleteWallLane[] = windowLanes([...Object.values(HOUSE_WALLS), FRONT_WALL], completeWallLane)

// Working numbers, tuned by eye. The attic fan's heat leaves through the left gable's vent at the vent's own height, from
// just inside the gable out into the yard.
export const ATTIC_FAN_LANE: { vent: Vec3, outside: Vec3 } = {
  vent: [-HOUSE.halfLength + 0.5, GABLE_VENT_Y, 0],
  outside: [-HOUSE.halfLength - 1.2, GABLE_VENT_Y, 0],
}

// Working numbers, tuned by eye. A ceiling opening's leak runs this far above and below the ceiling at the wall top, at a
// flow that draws two arrows: a gap, not a face, so it reads as a trickle beside the roof's lanes.
export const CEILING_LEAK_LANE = { above: 0.35, below: 0.5, flow: 0.3 } as const

// Up close each face system draws the whole home's flows for its face.
export const CUTAWAY_FACE_FLOW_KEY = { windows: 'window', walls: 'wall' } as const satisfies Record<CutawayFaceSystemId, keyof HeatLaneFlows>
