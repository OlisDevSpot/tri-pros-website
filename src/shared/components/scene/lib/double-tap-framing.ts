import type { Box3, Vector3 } from 'three'

import type { CameraFraming } from '@/shared/components/scene/types'

interface DoubleTapFramingArgs {
  point: Vector3
  position: Vector3
  target: Vector3
  box: Box3
  maxDistance: number
}

// Keeps the viewing direction, so the glide goes toward the spot instead of swinging the view around.
export function doubleTapFraming({ point, position, target, box, maxDistance }: DoubleTapFramingArgs): Pick<CameraFraming, 'position' | 'target'> {
  const goalTarget = box.clampPoint(point, point.clone())
  const offset = position.clone().sub(target)
  const distance = Math.min(offset.length(), maxDistance)
  const goalPosition = goalTarget.clone().add(offset.setLength(distance))
  return { position: goalPosition.toArray(), target: goalTarget.toArray() }
}
