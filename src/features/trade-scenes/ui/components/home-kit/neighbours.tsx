'use client'

import { useMemo } from 'react'

import { NEIGHBOUR_HOUSES } from '@/features/trade-scenes/constants/neighbourhood'
import { neighbourGeometry } from '@/features/trade-scenes/ui/lib/neighbour-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

// The street round the lot, in three draw calls. Scenery only: no shadows (they would reach past the lot's shadow camera),
// and a double-tap passes through. A camera orbited into one sees it vanish, its faces all turned away.
export function Neighbours() {
  const built = useMemo(() => neighbourGeometry(NEIGHBOUR_HOUSES), [])
  const walls = useOwnedGeometry(() => built.walls, [built])
  const roofs = useOwnedGeometry(() => built.roofs, [built])
  const windows = useOwnedGeometry(() => built.windows, [built])

  return (
    <group>
      <mesh geometry={walls} raycast={ignoreRaycast}>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      <mesh geometry={roofs} raycast={ignoreRaycast}>
        <meshStandardMaterial vertexColors roughness={0.8} flatShading />
      </mesh>
      <mesh geometry={windows} raycast={ignoreRaycast}>
        <meshStandardMaterial vertexColors roughness={0.3} metalness={0.1} />
      </mesh>
    </group>
  )
}
