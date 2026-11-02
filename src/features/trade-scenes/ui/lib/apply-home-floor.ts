import type { Object3D } from 'three'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'

const DRAWN_UNDER_FLOOR = HOUSE.floorY - HOUSE.floorThickness

// The house is drawn with its floor at one height; `lift` raises or settles it to the foundation's, and `ground` (a child
// of `lift`) undoes the lift and stretches from grade to the floor's underside, so what stands on the ground grows or
// folds with the floor.
export function applyHomeFloor(lift: Object3D, ground: Object3D, floorY: number): void {
  const rise = floorY - HOUSE.floorY
  lift.position.y = rise
  ground.position.y = -rise
  ground.scale.y = (floorY - HOUSE.floorThickness) / DRAWN_UNDER_FLOOR
}
