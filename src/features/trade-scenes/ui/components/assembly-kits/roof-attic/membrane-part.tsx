'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'

import { KIT_COLORS, KIT_SLOPE_FACES, LOW_SLOPE_KIT, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { SlopeFrame } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/slope-frame'
import { Slab } from '@/shared/components/scene/ui/slab'

const { overhang, deck, membrane, iceWaterReach, depth } = PITCHED_KIT
const LOW = LOW_SLOPE_KIT

// The self-sealing eave membrane: a dark strip on the deck along the eave, where water backs up first.
export function MembranePart({ form }: PartRendererProps) {
  if (homeRoofForm(form) === 'low-slope') {
    const front = -LOW.halfSpan - LOW.overhang
    return <Slab size={[LOW.iceWaterReach, LOW.membrane, LOW.depth]} position={[front + LOW.iceWaterReach / 2, LOW.joistDepth + LOW.deck + LOW.membrane / 2, 0]} color={KIT_COLORS.iceWater} roughness={0.5} />
  }
  return (
    <>
      {KIT_SLOPE_FACES.map(face => (
        <SlopeFrame key={face} face={face}>
          <Slab size={[iceWaterReach + overhang, membrane, depth]} position={[(iceWaterReach - overhang) / 2, deck + membrane / 2, 0]} color={KIT_COLORS.iceWater} roughness={0.5} />
        </SlopeFrame>
      ))}
    </>
  )
}
