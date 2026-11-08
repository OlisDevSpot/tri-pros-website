import type { CameraFraming } from '@/shared/components/scene/types'

// The views are set on the house at one height; each has to rise or settle with the house's lift to land on what it looks at.
export function liftedFraming(framing: CameraFraming, lift: number): CameraFraming {
  const [px, py, pz] = framing.position
  const [tx, ty, tz] = framing.target
  return { position: [px, py + lift, pz], target: [tx, ty + lift, tz], fov: framing.fov }
}
