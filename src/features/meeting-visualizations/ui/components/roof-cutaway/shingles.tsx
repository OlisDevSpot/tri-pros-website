'use client'

import { useMemo } from 'react'
import { BoxGeometry } from 'three'
import { COVERING_BASE, MATERIAL_COLORS, SCENE } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { layoutShingles, SHINGLE_LENGTH } from '@/features/meeting-visualizations/lib/roof-geometry'
import { InstancedPieces } from '@/features/meeting-visualizations/ui/components/roof-cutaway/instanced-pieces'
import { useOwnedGeometry } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

export function Shingles({ worn, seed }: { worn: boolean, seed: number }) {
  const pieces = useMemo(() => layoutShingles({ seed, worn, base: COVERING_BASE }), [seed, worn])
  const geometry = useOwnedGeometry(() => new BoxGeometry(SHINGLE_LENGTH, SCENE.shingleThickness, 1), [])
  return (
    <InstancedPieces
      geometry={geometry}
      pieces={pieces}
      color={worn ? MATERIAL_COLORS.shingleWorn : MATERIAL_COLORS.shingleNew}
      stretchToWidth
      roughness={worn ? 1 : 0.8}
    />
  )
}
