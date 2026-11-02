'use client'

import type { KitSlopeFace } from '@/features/trade-scenes/constants/roof-attic-kit'

import { useMemo } from 'react'
import { BoxGeometry } from 'three'

import { KIT_ARCHITECTURAL_SHINGLE, KIT_SHINGLE, KIT_SLOPE_SEEDS, PITCHED_COVERING_BASE, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'
import { slopeEndFor } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { layoutShingles } from '@/features/trade-scenes/lib/shingle-layout'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'

interface ShingleCoveringProps {
  face: KitSlopeFace
  worn: boolean
  color: string
}

const { overhang, depth } = PITCHED_KIT

// Old shingles are even three-tab rows, faded, with gaps and lifted tabs; new ones are thicker laminated shingles with uneven
// tabs. One instanced draw per slope.
export function ShingleCovering({ face, worn, color }: ShingleCoveringProps) {
  const course = worn ? KIT_SHINGLE : KIT_ARCHITECTURAL_SHINGLE
  const geometry = useOwnedGeometry(() => new BoxGeometry(course.length, course.thickness, 1), [course])
  const pieces = useMemo(() => layoutShingles({
    seed: KIT_SLOPE_SEEDS[face],
    wear: worn ? WEAR_AMOUNT.worn : 0,
    xFrom: -overhang,
    xTo: slopeEndFor(PITCHED_COVERING_BASE),
    zFrom: -depth / 2,
    zTo: depth / 2,
    base: PITCHED_COVERING_BASE,
  }, course), [face, worn, course])

  return <InstancedPieces geometry={geometry} pieces={pieces} color={color} stretchToWidth roughness={worn ? 1 : 0.8} />
}
