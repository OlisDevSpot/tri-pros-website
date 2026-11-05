import type { CameraFraming } from '@/shared/components/scene/types'

// The anchors are drawn on the house at one height; the zoom has to rise or settle with the house to land on them.
export function liftedFraming(framing: CameraFraming, lift: number): CameraFraming {
  const [px, py, pz] = framing.position
  const [tx, ty, tz] = framing.target
  return { position: [px, py + lift, pz], target: [tx, ty + lift, tz], fov: framing.fov }
}
