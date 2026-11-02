import type { BoxSpec } from '@/features/trade-scenes/types'

import { FRONT_DOOR, FRONT_DOOR_FRAME, FRONT_WALL, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'

const { jamb: JAMB, depth: DEPTH, leaf: LEAF, inset: INSET } = FRONT_DOOR_FRAME
const LEFT = FRONT_DOOR.along - FRONT_DOOR.width / 2
const RIGHT = FRONT_DOOR.along + FRONT_DOOR.width / 2
const HEAD = HOUSE.floorY + FRONT_DOOR.head

// The front door in its opening: the frame (both jambs, then the head) and the shut leaf hung in from the wall's outside face.
export const FRONT_DOOR_BOXES = {
  frame: [
    wallBox(FRONT_WALL, [LEFT, LEFT + JAMB], [HOUSE.floorY, HEAD], 0, DEPTH),
    wallBox(FRONT_WALL, [RIGHT - JAMB, RIGHT], [HOUSE.floorY, HEAD], 0, DEPTH),
    wallBox(FRONT_WALL, [LEFT, RIGHT], [HEAD - JAMB, HEAD], 0, DEPTH),
  ],
  leaf: [
    wallBox(FRONT_WALL, [LEFT + JAMB, RIGHT - JAMB], [HOUSE.floorY, HEAD - JAMB], HOUSE.wallThickness / 2 - INSET - LEAF / 2, LEAF),
  ],
} as const satisfies Record<'frame' | 'leaf', readonly BoxSpec[]>
