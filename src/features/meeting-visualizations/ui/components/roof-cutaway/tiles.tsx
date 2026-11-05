'use client'

import { useMemo } from 'react'
import { CylinderGeometry } from 'three'
import { COVERING_BASE, MATERIAL_COLORS, SCENE } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { layoutTiles, TILE_LENGTH } from '@/features/meeting-visualizations/lib/roof-geometry'
import { InstancedPieces } from '@/features/meeting-visualizations/ui/components/roof-cutaway/instanced-pieces'
import { useOwnedGeometry } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

/** A half-pipe whose axis runs down the slope; `upper` picks the cap's arc over the pan's. */
function halfPipe(upper: boolean): CylinderGeometry {
  const geometry = new CylinderGeometry(SCENE.tileRadius, SCENE.tileRadius, TILE_LENGTH, 14, 1, true, upper ? 0 : Math.PI, Math.PI)
  geometry.rotateZ(Math.PI / 2)
  return geometry
}

export function Tiles({ worn, seed }: { worn: boolean, seed: number }) {
  const { pans, caps } = useMemo(() => layoutTiles({ seed, worn, base: COVERING_BASE }), [seed, worn])
  const capGeometry = useOwnedGeometry(() => halfPipe(true), [])
  const panGeometry = useOwnedGeometry(() => halfPipe(false), [])
  const color = worn ? MATERIAL_COLORS.tileWorn : MATERIAL_COLORS.tileNew
  return (
    <>
      <InstancedPieces geometry={panGeometry} pieces={pans} color={color} roughness={0.75} doubleSided />
      <InstancedPieces geometry={capGeometry} pieces={caps} color={color} roughness={0.75} doubleSided />
    </>
  )
}
