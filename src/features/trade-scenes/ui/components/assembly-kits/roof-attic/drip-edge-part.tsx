'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'

import { KIT_COLORS, KIT_DRIP_EDGE, KIT_SLOPE_FACES, LOW_SLOPE_COVERING_BASE, LOW_SLOPE_KIT, PITCHED_COVERING_BASE, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { SlopeFrame } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/slope-frame'
import { Slab } from '@/shared/components/scene/ui/slab'

const { flange, leg, thickness } = KIT_DRIP_EDGE
const { overhang, pitch, depth } = PITCHED_KIT
const LOW = LOW_SLOPE_KIT

// An L of metal at the roof's edge: one leg under the covering, one hanging plumb past the fascia so water drips clear of it.
export function DripEdgePart({ condition, form }: PartRendererProps) {
  const metal = { color: condition === 'worn' ? KIT_COLORS.metalWorn : KIT_COLORS.metal, roughness: condition === 'worn' ? 0.6 : 0.3, metalness: 0.85 }

  if (homeRoofForm(form) === 'low-slope') {
    const front = -LOW.halfSpan - LOW.overhang - LOW.fascia
    return (
      <>
        <Slab size={[flange, thickness, LOW.depth]} position={[front + flange / 2, LOW_SLOPE_COVERING_BASE + thickness / 2, 0]} {...metal} />
        <Slab size={[thickness, leg, LOW.depth]} position={[front - thickness / 2, LOW_SLOPE_COVERING_BASE - leg / 2 + thickness, 0]} {...metal} />
      </>
    )
  }
  return (
    <>
      {KIT_SLOPE_FACES.map(face => (
        <SlopeFrame key={face} face={face}>
          <Slab size={[flange, thickness, depth]} position={[-overhang + flange / 2, PITCHED_COVERING_BASE + thickness / 2, 0]} {...metal} />
          {/* Plumb in the world, so it is turned back against the pitch. */}
          <Slab
            size={[thickness, leg, depth]}
            position={[-overhang - (leg / 2) * Math.sin(pitch), PITCHED_COVERING_BASE - (leg / 2) * Math.cos(pitch), 0]}
            rotation={[0, 0, -pitch]}
            {...metal}
          />
        </SlopeFrame>
      ))}
    </>
  )
}
