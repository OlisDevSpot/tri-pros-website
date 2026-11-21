'use client'

import type { Ref } from 'react'
import type { MeshStandardMaterial } from 'three'
import type { BoxSpec, SurfaceTexture } from '@/features/trade-scenes/types'

import { TexturedMaterial } from '@/features/trade-scenes/ui/components/home-kit/textured-material'
import { mergeBoxes } from '@/features/trade-scenes/ui/lib/merge-boxes'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface MergedBoxesProps {
  // Callers pass a memoized or module-level list: a new array rebuilds the geometry.
  boxes: readonly BoxSpec[]
  color: string
  // Maps the boxes in metres and draws the texture, eased in over `color` once it arrives.
  texture?: SurfaceTexture
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

export function MergedBoxes({ boxes, color, texture, radius = 0, roughness = 0.9, metalness = 0, emissive, emissiveIntensity = 0, opacity = 1, castShadow = false, receiveShadow = false, materialRef, ignoreTaps }: MergedBoxesProps) {
  // Keyed on the mapping, never the texture object, so an inline `texture={{…}}` does not rebuild the geometry.
  const uvs = texture ? 'metres' : 'per-box'
  const geometry = useOwnedGeometry(() => mergeBoxes(boxes, radius, uvs), [boxes, radius, uvs])
  // Spread only when set: `raycast={undefined}` would replace three's own raycast with nothing.
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow} {...(ignoreTaps ? { raycast: ignoreRaycast } : {})}>
      {texture
        ? (
            <TexturedMaterial
              ref={materialRef}
              {...texture}
              color={color}
              roughness={roughness}
              metalness={metalness}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
              opacity={opacity}
            />
          )
        : (
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
          )}
    </mesh>
  )
}
