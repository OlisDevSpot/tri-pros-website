'use client'

import type { PartState } from '@/features/trade-scenes/lib/part-state'

import { EAVE_RUN, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { Slab } from '@/shared/components/scene/ui/slab'

interface EaveMembraneProps {
  /** The run along the eave, in the slope's own z. */
  zFrom: number
  zTo: number
  iceAndWater: PartState
}

const { deckThickness: DECK, underlaymentThickness } = HOUSE
// The band runs from the eave to about two feet inside the wall line, where water backs up first. A working number.
const BAND_TOP = 0.75
// Thinner than the underlayment, so laid over it the underlayment covers it until a step opens it.
const THICKNESS = underlaymentThickness * 0.6

// In a slope's own frame, on the deck along the eave and under the underlayment.
export function EaveMembrane({ zFrom, zTo, iceAndWater }: EaveMembraneProps) {
  if (iceAndWater.material === null) {
    return null
  }
  // One unit long along the eave and stretched to its run, so a step that moves its start rebuilds no geometry.
  return (
    <group userData={thermalTag(null, 'ice-and-water')}>
      <group userData={systemPartTag('ice-and-water')}>
        <group position={[0, 0, (zFrom + zTo) / 2]} scale={[1, 1, zTo - zFrom]}>
          <Slab size={[BAND_TOP + EAVE_RUN, THICKNESS, 1]} position={[(BAND_TOP - EAVE_RUN) / 2, DECK + THICKNESS / 2, 0]} color={HOME_PALETTE.felt} roughness={0.95} />
        </group>
      </group>
    </group>
  )
}
