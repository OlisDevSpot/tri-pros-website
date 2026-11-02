'use client'

import type { KitSlopeFace } from '@/features/trade-scenes/constants/roof-attic-kit'

import { useMemo } from 'react'

import { KIT_SHAKE, KIT_SHAKE_TIP, KIT_SLOPE_SEEDS, PITCHED_COVERING_BASE, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'
import { slopeEndFor } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { layoutShakes } from '@/features/trade-scenes/lib/shake-layout'
import { createShakeGeometry } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/lib/create-shake-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'

interface WoodShakeCoveringProps {
  face: KitSlopeFace
  worn: boolean
  color: string
}

const { overhang, depth } = PITCHED_KIT

// Thick tapered shakes in staggered courses of uneven widths; weathered ones go grey-brown, curl and split down the grain.
export function WoodShakeCovering({ face, worn, color }: WoodShakeCoveringProps) {
  const geometry = useOwnedGeometry(() => createShakeGeometry(KIT_SHAKE.length, KIT_SHAKE.thickness, KIT_SHAKE_TIP), [])
  const pieces = useMemo(() => layoutShakes({
    seed: KIT_SLOPE_SEEDS[face],
    wear: worn ? WEAR_AMOUNT.worn : 0,
    xFrom: -overhang,
    xTo: slopeEndFor(PITCHED_COVERING_BASE),
    zFrom: -depth / 2,
    zTo: depth / 2,
    base: PITCHED_COVERING_BASE,
  }, KIT_SHAKE), [face, worn])

  return <InstancedPieces geometry={geometry} pieces={pieces} color={color} stretchToWidth roughness={0.95} />
}
