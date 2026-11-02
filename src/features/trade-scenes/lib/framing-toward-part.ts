import type { CameraFraming } from '@/shared/components/scene/types'

import { KIT_EMPHASIS_FRAMING } from '@/features/trade-scenes/constants/assembly-kits'

// The anchor's framing moved toward an emphasised part: the target slides most of the way to it and the camera follows in a
// little closer, keeping the same angle so the glide reads as leaning in, not as a new view.
export function framingTowardPart(framing: CameraFraming, offset: readonly [number, number, number]): CameraFraming {
  const { share, dolly } = KIT_EMPHASIS_FRAMING
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
