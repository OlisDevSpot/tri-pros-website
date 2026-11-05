'use client'

import type { InstancedMesh } from 'three'
import type { PlantPlacement } from '@/features/trade-scenes/constants/lot-plants'
import type { PlantSpecies } from '@/features/trade-scenes/types'

import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { DoubleSide, Matrix4 } from 'three'

import { plantGeometry, plantMatrix } from '@/features/trade-scenes/ui/lib/plant-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface PlantInstancesProps {
  species: PlantSpecies
  // A memoized or module-level list: a new array rewrites every matrix.
  placements: readonly PlantPlacement[]
  // A far plant casts no shadow and lets a double-tap through to the ground.
  far: boolean
}

// One draw call per species, however many stand round the lot. The fronds and blades are drawn double-sided rather than cut
// out of a card, so the thermal paint covers both faces of each leaf.
export function PlantInstances({ species, placements, far }: PlantInstancesProps) {
  const geometry = useOwnedGeometry(() => plantGeometry(species), [species])
  const mesh = useRef<InstancedMesh>(null)
  const invalidate = useThree(state => state.invalidate)

  useLayoutEffect(() => {
    const node = mesh.current
    if (!node) {
      return
    }
    const matrix = new Matrix4()
    placements.forEach((placement, index) => node.setMatrixAt(index, plantMatrix(placement, matrix)))
    node.instanceMatrix.needsUpdate = true
    node.computeBoundingSphere()
    invalidate()
  }, [geometry, placements, invalidate])

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, placements.length]}
      key={placements.length}
      castShadow={!far}
      receiveShadow={!far}
      {...(far ? { raycast: ignoreRaycast } : {})}
    >
      <meshStandardMaterial vertexColors roughness={0.85} side={DoubleSide} />
    </instancedMesh>
  )
}
