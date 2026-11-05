'use client'

import type { Ref } from 'react'
import type { MeshStandardMaterial } from 'three'
import type { BoxSpec } from '@/features/trade-scenes/types'

import { mergeBoxes } from '@/features/trade-scenes/ui/lib/merge-boxes'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface MergedBoxesProps {
  // Callers pass a memoized or module-level list: a new array rebuilds the geometry.
  boxes: readonly BoxSpec[]
  color: string
  radius?: number
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
  castShadow?: boolean
  receiveShadow?: boolean
  // For a value eased frame by frame (a glow), written straight to the material instead of re-rendering the boxes.
  materialRef?: Ref<MeshStandardMaterial>
  // A double-tap passes through to what the boxes stand on.
  ignoreTaps?: true
}

export function MergedBoxes({ boxes, color, radius = 0, roughness = 0.9, metalness = 0, emissive, emissiveIntensity = 0, opacity = 1, castShadow = false, receiveShadow = false, materialRef, ignoreTaps }: MergedBoxesProps) {
  const geometry = useOwnedGeometry(() => mergeBoxes(boxes, radius), [boxes, radius])
  // Spread only when set: `raycast={undefined}` would replace three's own raycast with nothing.
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow} {...(ignoreTaps ? { raycast: ignoreRaycast } : {})}>
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </mesh>
  )
}
