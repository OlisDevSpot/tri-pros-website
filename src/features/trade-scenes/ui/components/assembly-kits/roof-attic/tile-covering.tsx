'use client'

import type { KitSlopeFace } from '@/features/trade-scenes/constants/roof-attic-kit'

import { useMemo } from 'react'

import { KIT_SLOPE_SEEDS, KIT_TILE, PITCHED_COVERING_BASE, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'
import { slopeEndFor } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { layoutTiles } from '@/features/trade-scenes/lib/tile-layout'
import { createHalfPipeGeometry } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/lib/create-half-pipe-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'

interface TileCoveringProps {
  face: KitSlopeFace
  worn: boolean
  color: string
}

const { overhang, depth } = PITCHED_KIT

// Barrel tile: pans open upward and caps lap the seams between them, one instanced draw each per slope.
export function TileCovering({ face, worn, color }: TileCoveringProps) {
  const pan = useOwnedGeometry(() => createHalfPipeGeometry(KIT_TILE.radius, KIT_TILE.length, false), [])
  const cap = useOwnedGeometry(() => createHalfPipeGeometry(KIT_TILE.radius, KIT_TILE.length, true), [])
  const { pans, caps } = useMemo(() => layoutTiles({
    seed: KIT_SLOPE_SEEDS[face],
    wear: worn ? WEAR_AMOUNT.worn : 0,
    xFrom: -overhang,
    xTo: slopeEndFor(PITCHED_COVERING_BASE),
    zFrom: -depth / 2,
    zTo: depth / 2,
    base: PITCHED_COVERING_BASE,
  }, KIT_TILE), [face, worn])

  return (
    <>
      <InstancedPieces geometry={pan} pieces={pans} color={color} roughness={0.75} doubleSided />
      <InstancedPieces geometry={cap} pieces={caps} color={color} roughness={0.75} doubleSided />
    </>
  )
}
