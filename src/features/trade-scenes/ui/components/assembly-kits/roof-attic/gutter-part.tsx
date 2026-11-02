'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'

import { KIT_COLORS, KIT_GUTTER, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { gutterCentre } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { Slab } from '@/shared/components/scene/ui/slab'

const { width, height, wall, sag } = KIT_GUTTER
const RUN = PITCHED_KIT.depth

// An open trough along the eave, read end-on at the cut: back, bottom and a front lip. Old runs sag and dull.
export function GutterPart({ condition, form }: PartRendererProps) {
  const worn = condition === 'worn'
  const [x, y] = gutterCentre(homeRoofForm(form))
  const look = { color: worn ? KIT_COLORS.gutterWorn : KIT_COLORS.gutter, roughness: worn ? 0.8 : 0.45, metalness: 0.3 }
  return (
    <group position={[x, y, 0]} rotation={[worn ? Math.atan(sag / RUN) : 0, 0, 0]}>
      <Slab size={[wall, height, RUN]} position={[width / 2 - wall / 2, 0, 0]} {...look} />
      <Slab size={[width, wall, RUN]} position={[0, -height / 2 + wall / 2, 0]} {...look} />
      <Slab size={[wall, height * 1.1, RUN]} position={[-width / 2 + wall / 2, height * 0.05, 0]} {...look} />
      <Slab size={[width * 0.35, wall, RUN]} position={[-width / 2 + width * 0.175, height * 0.6, 0]} {...look} />
    </group>
  )
}
