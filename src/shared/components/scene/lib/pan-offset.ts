import { Vector3 } from 'three'

interface PanOffsetArgs {
  dxPx: number
  dyPx: number
  right: Vector3
  up: Vector3
  worldPerPx: number
}

// Camera and target move against the drag so the content follows the fingers.
export function panOffset({ dxPx, dyPx, right, up, worldPerPx }: PanOffsetArgs): Vector3 {
  return new Vector3()
    .addScaledVector(right, -dxPx * worldPerPx)
    .addScaledVector(up, dyPx * worldPerPx)
}
