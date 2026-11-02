'use client'

import { KIT_COLORS, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { PITCHED_RIDGE_TOP } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { Slab } from '@/shared/components/scene/ui/slab'

const { run, thickness, slot } = PITCHED_KIT.ridgeVent
const { pitch, depth } = PITCHED_KIT

// A low cap along the peak over a slot cut in the deck: attic heat escapes all along the ridge. Gable roofs only.
export function RidgeVentPart() {
  const halfRun = (run / 2) * Math.cos(pitch)
  const drop = (run / 2) * Math.sin(pitch)
  return (
    <>
      {([-1, 1] as const).map(side => (
        <Slab
          key={side}
          size={[run, thickness, depth]}
          position={[side * halfRun, PITCHED_RIDGE_TOP + slot - drop + thickness / 2, 0]}
          rotation={[0, 0, -side * pitch]}
          color={KIT_COLORS.ridgeVent}
          roughness={0.6}
        />
      ))}
    </>
  )
}
