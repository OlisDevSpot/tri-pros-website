import type { CameraFraming } from '@/shared/components/scene/types'

import { HOME_FRAMINGS, TALL_BELOW_ASPECT } from '@/features/trade-scenes/constants/home-geometry'

export function homeFramingFor(aspect: number): CameraFraming {
  const framing = aspect < TALL_BELOW_ASPECT ? HOME_FRAMINGS.tall : HOME_FRAMINGS.wide
  return { position: [...framing.position], target: [...framing.target], fov: framing.fov }
}
