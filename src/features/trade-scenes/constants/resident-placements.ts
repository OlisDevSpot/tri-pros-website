import type { ResidentPlacement } from '@/features/trade-scenes/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'

const FLOOR = HOUSE.floorY
const BACK = -HOUSE.halfDepth + HOUSE.wallThickness

// The pack's figures stand about 4.8 units tall; this brings an adult to about 1.7 m.
export const RESIDENT_UNIT_SCALE = 0.355
// There is no child figure in the pack, so a child is an adult figure at this size.
export const CHILD_SCALE = 0.65

// The pack's sitting pose holds its hips a little under a cushioned seat; seated figures stand this much higher, their
// feet a hair off the floor where the eye does not go.
const SEAT_LIFT = 0.05

// Adults by cast order: both ends of the sofa, then the kitchen table's far chair (the near one hides behind the cut
// partition from the opening view). Children stand on the living-room rug, in front of the sofa where the camera finds them.
// A seated figure settles about 0.2 m back from its feet onto the seat, its knees just past the seat's front edge.
export const RESIDENT_PLACEMENTS = {
  adults: [
    { position: [-0.24, FLOOR + SEAT_LIFT, BACK + 0.88], rotationY: 0, pose: 'seated' },
    { position: [0.64, FLOOR + SEAT_LIFT, BACK + 0.88], rotationY: 0, pose: 'seated' },
    { position: [4.49, FLOOR + SEAT_LIFT, 1.3], rotationY: -Math.PI / 2, pose: 'seated' },
  ],
  children: [
    { position: [-0.85, FLOOR, -1.2], rotationY: 0.45, pose: 'standing' },
    { position: [1.0, FLOOR, -1.35], rotationY: -0.5, pose: 'standing' },
  ],
} as const satisfies Record<'adults' | 'children', readonly ResidentPlacement[]>
