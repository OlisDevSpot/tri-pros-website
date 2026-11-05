import type { Vec3 } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'

import { PART_EMPHASIS_FRAMING } from '@/features/trade-scenes/constants/system-camera-views'

// A system's framing moved toward an emphasised part: the target slides most of the way to it and the camera follows in a
// little closer, keeping the same angle so the glide reads as leaning in, not as a new view.
export function framingTowardPart(framing: CameraFraming, offset: readonly [number, number, number]): CameraFraming {
  const { share, dolly } = PART_EMPHASIS_FRAMING
  const target: [number, number, number] = [
    framing.target[0] + offset[0] * share,
    framing.target[1] + offset[1] * share,
    framing.target[2] + offset[2] * share,
  ]
  return {
    target,
    position: [
      target[0] + (framing.position[0] - framing.target[0]) * dolly,
      target[1] + (framing.position[1] - framing.target[1]) * dolly,
      target[2] + (framing.position[2] - framing.target[2]) * dolly,
    ],
    fov: framing.fov,
  }
}

// A system part's point is placed on the house at rest, and the framing on the house as the foundation lifts it, so the
// lean toward it is its offset from the framing's target once lifted.
export function partOffset(framing: CameraFraming, point: Vec3, lift: number): Vec3 {
  return [point[0] - framing.target[0], point[1] + lift - framing.target[1], point[2] - framing.target[2]]
}
