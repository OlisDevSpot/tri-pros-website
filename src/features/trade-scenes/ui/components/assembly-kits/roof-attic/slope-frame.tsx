'use client'

import type { ReactNode } from 'react'
import type { KitSlopeFace } from '@/features/trade-scenes/constants/roof-attic-kit'

import { PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'

interface SlopeFrameProps {
  face: KitSlopeFace
  children: ReactNode
}

// One side of the gable in the slope's own frame: x runs eave to ridge from the wall line, y is the roof normal from the
// rafters' top, z runs along the ridge. The back slope is the same drawing turned half a circle about the ridge's vertical axis.
export function SlopeFrame({ face, children }: SlopeFrameProps) {
  return (
    <group rotation={[0, face === 'back' ? Math.PI : 0, 0]}>
      <group position={[-PITCHED_KIT.halfSpan, PITCHED_KIT.joistDepth, 0]} rotation={[0, 0, PITCHED_KIT.pitch]}>
        {children}
      </group>
    </group>
  )
}
