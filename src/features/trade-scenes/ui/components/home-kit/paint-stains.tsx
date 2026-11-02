'use client'

import type { CanvasTexture } from 'three'
import type { StainBoxes } from '@/features/trade-scenes/types'

import { BLUEPRINT_OMIT_TAG } from '@/features/trade-scenes/constants/scene-load'
import { createStainAtlas } from '@/features/trade-scenes/ui/lib/create-stain-atlas'
import { emptyStainGeometry, mergeStainBoxes } from '@/features/trade-scenes/ui/lib/vertex-tinted-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface PaintStainsProps {
  // Callers pass a memoized list: a new array rebuilds the geometry.
  lists: readonly StainBoxes[]
  thermal: boolean
}

// three sorts see-through meshes by this before their depth, so a wall fading with its view never blends over its stains.
const STAIN_ORDER = 1

// One atlas for every stain on the house, drawn on first use because the canvas only exists in the browser.
let atlas: CanvasTexture | null = null
function stainAtlas(): CanvasTexture {
  atlas ??= createStainAtlas()
  return atlas
}

// The see-through stains on a painted surface, in one draw; each stain's strength rides in its vertex colour, since the view
// fades own the material's opacity. They step aside under the Thermal lens and stay out of the blueprint, as the marks do.
// With nothing to draw the mesh stays mounted and hidden, so the load compiles its program once rather than the first tap
// that stains the walls. It takes the wall's shadows, or a stain would glow in the eave's.
export function PaintStains({ lists, thermal }: PaintStainsProps) {
  const geometry = useOwnedGeometry(() => mergeStainBoxes(lists) ?? emptyStainGeometry(), [lists])
  const empty = geometry.getAttribute('position').count === 0
  return (
    <group visible={!thermal && !empty} userData={BLUEPRINT_OMIT_TAG}>
      <mesh geometry={geometry} raycast={ignoreRaycast} renderOrder={STAIN_ORDER} receiveShadow>
        <meshStandardMaterial vertexColors alphaMap={stainAtlas()} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  )
}
