import type { CylinderSpec } from '@/features/trade-scenes/types'

import { CEILING_OPENING_LOOK } from '@/features/trade-scenes/constants/home-details'
import { CEILING_OPENINGS, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { coveringBaseY } from '@/features/trade-scenes/lib/covering-base-y'
import { coveringStandoff } from '@/features/trade-scenes/lib/home-heat-lanes'

const { stubAbove, flashing } = CEILING_OPENING_LOOK
const PIPES = CEILING_OPENINGS.filter(opening => opening.kind === 'pipe')

// Each stub rises from the roof's surface under the covering, so no gap shows beneath a tile's crowns, to `stubAbove` over the
// covering's top, where its flashing lies flat on the slope under it. A flat roof's membrane top is its surface already:
// stood off it, the flashing would float.
export function ventPipeStubCylinders(lowSlope: boolean, covering: string | null): { pipes: CylinderSpec[], flashings: CylinderSpec[] } {
  const form = lowSlope ? 'low-slope' : 'pitched'
  const standoff = lowSlope ? 0 : coveringStandoff(covering)
  const pipes: CylinderSpec[] = []
  const flashings: CylinderSpec[] = []
  for (const { at: [x, z], radius } of PIPES) {
    const base = coveringBaseY(z, form)
    const top = base + standoff + stubAbove
    pipes.push({ radiusTop: radius, radiusBottom: radius, height: top - base, segments: 14, position: [x, (base + top) / 2, z] })
    const tilt = lowSlope ? 0 : Math.sign(z) * HOUSE.pitch
    flashings.push({ radiusTop: radius + flashing.reach, radiusBottom: radius + flashing.reach, height: flashing.height, segments: 20, position: [x, base + standoff + flashing.height / 2, z], rotation: [tilt, 0, 0] })
  }
  return { pipes, flashings }
}
