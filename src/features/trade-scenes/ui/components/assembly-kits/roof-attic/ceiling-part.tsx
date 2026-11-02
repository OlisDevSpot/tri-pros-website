'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { useMemo } from 'react'
import { BoxGeometry } from 'three'

import { KIT_COLORS, KIT_PENETRATIONS, LOW_SLOPE_KIT, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { centredFramingGrid } from '@/features/trade-scenes/lib/kit-framing'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'
import { Slab } from '@/shared/components/scene/ui/slab'

const SPAN = PITCHED_KIT.halfSpan * 2

// The drywall and, under a gable, the ceiling joists it hangs from; a flat roof's joists are the roof's own. The light's can
// and the vent pipe come through it: they are the gaps air sealing closes.
export function CeilingPart({ form }: PartRendererProps) {
  const roofForm = homeRoofForm(form)
  const drywall = roofForm === 'low-slope' ? LOW_SLOPE_KIT.drywall : PITCHED_KIT.drywall
  const joistGeometry = useOwnedGeometry(() => new BoxGeometry(SPAN, PITCHED_KIT.joistDepth, 1), [])
  const joists = useMemo((): PieceLayout[] => centredFramingGrid(PITCHED_KIT.depth, PITCHED_KIT.joistWidth, PITCHED_KIT.framingSpacing)
    .map(z => ({ x: 0, y: PITCHED_KIT.joistDepth / 2, z, tilt: 0, width: PITCHED_KIT.joistWidth, shade: 1 })), [])
  const { light, pipe } = KIT_PENETRATIONS
  const pipeHeight = pipe.height[roofForm]

  return (
    <>
      <Slab size={[SPAN, drywall, PITCHED_KIT.depth]} position={[0, -drywall / 2, 0]} color={KIT_COLORS.drywall} roughness={0.95} />
      {roofForm === 'pitched' && <InstancedPieces geometry={joistGeometry} pieces={joists} color={KIT_COLORS.lumber} stretchToWidth />}
      <mesh position={[light.at[0], light.height / 2, light.at[1]]}>
        <cylinderGeometry args={[light.radius, light.radius * 1.1, light.height, 20]} />
        <meshStandardMaterial color={KIT_COLORS.lightCan} roughness={0.45} metalness={0.6} />
      </mesh>
      <mesh position={[pipe.at[0], pipeHeight / 2 - drywall, pipe.at[1]]}>
        <cylinderGeometry args={[pipe.radius, pipe.radius, pipeHeight + drywall, 14]} />
        <meshStandardMaterial color={KIT_COLORS.pipe} roughness={0.6} />
      </mesh>
    </>
  )
}
