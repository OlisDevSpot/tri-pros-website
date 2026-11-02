'use client'

import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { KIT_COLORS, LOW_SLOPE_KIT, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { LOW_SLOPE_PARAPET_TOP } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { Slab } from '@/shared/components/scene/ui/slab'

interface KitWallsProps {
  form: RoofForm
}

// Not a part: the wall stubs under the roof, so the section reads as a slice of a house. A flat roof's back wall carries on up
// as the parapet, capped with coping.
export function KitWalls({ form }: KitWallsProps) {
  const kit = form === 'low-slope' ? LOW_SLOPE_KIT : PITCHED_KIT
  const { height, thickness } = kit.wall
  const below = -kit.drywall - height / 2
  const x = kit.halfSpan - thickness / 2
  const wallLook = { color: KIT_COLORS.wall, roughness: 0.95 }

  if (form === 'pitched') {
    return (
      <>
        {([-1, 1] as const).map(side => (
          <Slab key={side} size={[thickness, height, kit.depth]} position={[side * x, below, 0]} {...wallLook} />
        ))}
      </>
    )
  }

  const { coping } = LOW_SLOPE_KIT.parapet
  const backHeight = LOW_SLOPE_PARAPET_TOP + kit.drywall + height
  return (
    <>
      <Slab size={[thickness, height, kit.depth]} position={[-x, below, 0]} {...wallLook} />
      <Slab size={[thickness, backHeight, kit.depth]} position={[x, LOW_SLOPE_PARAPET_TOP - backHeight / 2, 0]} {...wallLook} />
      <Slab size={[thickness + 0.05, coping, kit.depth + 0.02]} position={[x, LOW_SLOPE_PARAPET_TOP + coping / 2, 0]} color={KIT_COLORS.coping} roughness={0.7} />
    </>
  )
}
