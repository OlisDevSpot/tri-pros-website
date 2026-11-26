'use client'

import type { IndoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { returnGrilleBoxes } from '@/features/trade-scenes/lib/return-grille-boxes'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface ReturnGrilleProps {
  // A placement's own, so the grille never rebuilds.
  returnAir: IndoorUnitPlacement['returnAir']
}

// Where the blower pulls the room air back in: on the room side of the ceiling under an attic unit, low on the closet beside
// an upright one. It hangs in the room, so it shows whenever the rooms do, not only with the attic.
export function ReturnGrille({ returnAir }: ReturnGrilleProps) {
  const { frame, bars } = useMemo(() => returnGrilleBoxes(returnAir), [returnAir])
  return (
    <group userData={systemPartTag('return')}>
      <MergedBoxes boxes={frame} color={HOME_PALETTE.unit} radius={0.003} roughness={0.6} />
      <MergedBoxes boxes={bars} color={HOME_PALETTE.unitGrille} roughness={0.6} />
    </group>
  )
}
