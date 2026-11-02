'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'

import { KIT_COLORS, KIT_FOIL_LOOK, KIT_SLOPE_FACES, LOW_SLOPE_KIT, PITCHED_KIT, PITCHED_SLOPE_LENGTH } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { SlopeFrame } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/slope-frame'
import { Slab } from '@/shared/components/scene/ui/slab'

const FOIL = { color: KIT_COLORS.foil, ...KIT_FOIL_LOOK }
const LOW = LOW_SLOPE_KIT

// Foil stapled under the rafters, inside the walls (the overhang is outside the attic); under a flat roof, across the joist
// tops just below the deck.
export function RadiantBarrierPart({ form }: PartRendererProps) {
  if (homeRoofForm(form) === 'low-slope') {
    const run = LOW.halfSpan * 2 - LOW.wall.thickness * 2
    return <Slab size={[run, LOW.foil, LOW.depth]} position={[0, LOW.joistDepth - LOW.foil / 2, 0]} {...FOIL} />
  }
  return (
    <>
      {KIT_SLOPE_FACES.map(face => (
        <SlopeFrame key={face} face={face}>
          <Slab
            size={[PITCHED_SLOPE_LENGTH - PITCHED_KIT.wall.thickness, PITCHED_KIT.foil, PITCHED_KIT.depth]}
            position={[(PITCHED_SLOPE_LENGTH + PITCHED_KIT.wall.thickness) / 2, -PITCHED_KIT.rafterDepth - PITCHED_KIT.foil / 2, 0]}
            {...FOIL}
          />
        </SlopeFrame>
      ))}
    </>
  )
}
