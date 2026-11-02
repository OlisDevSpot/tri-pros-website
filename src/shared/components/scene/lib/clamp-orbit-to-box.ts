import type { Box3 } from 'three'

import { Vector3 } from 'three'

// Runs on every controls change, each frame of a glide or a damping tail, so it reuses its vectors.
const before = new Vector3()
const shift = new Vector3()

// Moving the camera by the target's delta keeps the orbit's angle and distance while the target stays in the box.
export function clampOrbitToBox(target: Vector3, position: Vector3, box: Box3): boolean {
  before.copy(target)
  box.clampPoint(target, target)
  if (target.equals(before)) {
    return false
  }
  position.add(shift.subVectors(target, before))
  return true
}
