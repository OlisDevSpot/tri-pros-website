'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'

import { KIT_COLORS, KIT_SLOPE_FACES, LOW_SLOPE_KIT, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { slopeEndFor } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { SlopeFrame } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/slope-frame'
import { Slab } from '@/shared/components/scene/ui/slab'

const { overhang, deck, membrane, depth } = PITCHED_KIT
const BASE = deck + membrane
const END = slopeEndFor(BASE + membrane)
const LOW = LOW_SLOPE_KIT

// Felt that dries and cracks in a baking attic, or a pale synthetic sheet that will not tear; under a flat roof, the base sheet.
export function UnderlaymentPart({ material, condition, form }: PartRendererProps) {
  const synthetic = material === 'synthetic'
  const color = synthetic ? KIT_COLORS.synthetic : condition === 'worn' ? KIT_COLORS.feltWorn : KIT_COLORS.felt
  const roughness = synthetic ? 0.55 : 1

  if (homeRoofForm(form) === 'low-slope') {
    const front = -LOW.halfSpan - LOW.overhang
    const back = LOW.halfSpan - LOW.wall.thickness
    return <Slab size={[back - front, LOW.membrane, LOW.depth]} position={[(front + back) / 2, LOW.joistDepth + LOW.deck + LOW.membrane * 1.5, 0]} color={color} roughness={roughness} />
  }
  return (
    <>
      {KIT_SLOPE_FACES.map(face => (
        <SlopeFrame key={face} face={face}>
          <Slab size={[END + overhang, membrane, depth]} position={[(END - overhang) / 2, BASE + membrane / 2, 0]} color={color} roughness={roughness} />
        </SlopeFrame>
      ))}
    </>
  )
}
