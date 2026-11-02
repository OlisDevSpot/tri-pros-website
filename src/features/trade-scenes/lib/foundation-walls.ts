import type { HouseWall, WallOpening } from '@/features/trade-scenes/types'

import { FOUNDATION } from '@/features/trade-scenes/constants/home-details'
import { CRAWL_VENT_Y, CRAWL_VENTS_X, CRAWL_VENTS_Z, FRONT_DOOR, FRONT_WALL, FRONT_WALL_PROUD, HOME_FLOOR_Y, HOUSE, HOUSE_WALLS } from '@/features/trade-scenes/constants/home-geometry'

// The ground group is drawn for the house's own floor and stretched up to a raised one, so a mark placed in it reads this much
// taller unless its height is divided by it.
export const RAISED_GROUND_STRETCH = (HOME_FLOOR_Y.raised - HOUSE.floorThickness) / (HOUSE.floorY - HOUSE.floorThickness)

// The vents hang outside the ground group, so their heights are carried into it at the raised floor, the only one that shows
// the skirt.
const RAISED_LIFT = HOME_FLOOR_Y.raised - HOUSE.floorY
const VENT_SILL = (CRAWL_VENT_Y - FOUNDATION.vent.high / 2 + RAISED_LIFT) / RAISED_GROUND_STRETCH
const VENT_HEAD = (CRAWL_VENT_Y + FOUNDATION.vent.high / 2 + RAISED_LIFT) / RAISED_GROUND_STRETCH

function vent(along: number): WallOpening {
  return { along, width: FOUNDATION.vent.long, sill: VENT_SILL, head: VENT_HEAD }
}

// The side skirts stop at the front skirt, whose end leaves with the Complete house: a mark run past it would hang in the air.
const SIDE_SKIRT_TO = HOUSE.halfDepth - HOUSE.wallThickness

// The raised foundation's skirt, on the house walls' lines in the ground group's frame, from grade to the floor's underside.
// Its openings are measured from grade, so a caller places marks on it with a floor at 0.
export const FOUNDATION_WALLS: Record<keyof typeof HOUSE_WALLS, HouseWall> = {
  back: { ...HOUSE_WALLS.back, openings: CRAWL_VENTS_X.map(vent) },
  left: { ...HOUSE_WALLS.left, to: SIDE_SKIRT_TO, openings: CRAWL_VENTS_Z.map(vent) },
  right: { ...HOUSE_WALLS.right, to: SIDE_SKIRT_TO, openings: CRAWL_VENTS_Z.map(vent) },
}

// The front skirt stands on its own line, not the front wall's proud one, so every foundation wall's face is half a wall out.
// The door's opening runs the skirt's full height, where the steps stand.
export const FOUNDATION_FRONT_WALL: HouseWall = {
  ...FRONT_WALL,
  line: FRONT_WALL.line - FRONT_WALL_PROUD,
  openings: [FRONT_DOOR, ...CRAWL_VENTS_X.map(vent)],
}
