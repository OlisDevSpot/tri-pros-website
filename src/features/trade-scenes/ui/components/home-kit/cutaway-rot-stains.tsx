'use client'

import type { CanvasTexture } from 'three'
import type { BoxSpec } from '@/features/trade-scenes/types'

import { CUTAWAY_FLOW_COLORS } from '@/features/trade-scenes/constants/home-palette'
import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'
import { BLUEPRINT_OMIT_TAG } from '@/features/trade-scenes/constants/scene-load'
import { createRotStainTexture } from '@/features/trade-scenes/ui/lib/create-rot-stain-texture'
import { mergeBoxes } from '@/features/trade-scenes/ui/lib/merge-boxes'
import { tintVertices } from '@/features/trade-scenes/ui/lib/vertex-tinted-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface CutawayRotStainsProps {
  // Callers pass a memoized list: a new array rebuilds the geometry.
  boxes: readonly BoxSpec[]
  thermal: boolean
  color?: string
  alpha?: number
}

// three sorts see-through meshes by this before their depth, as the paint stains do, so a step fading never blends over them.
const STAIN_ORDER = 1

// One shape for every rot stain, drawn on first use because the canvas only exists in the browser.
let texture: CanvasTexture | null = null
function rotStainTexture(): CanvasTexture {
  texture ??= createRotStainTexture()
  return texture
}

// See-through stains lying on a part's faces, in one draw: the rot still in the wood, the fascia's rot, the attic's dust. Their
// strength rides in the vertex colour and the material matches the paint stains', so they share its program. They step aside
// under the Thermal lens and stay out of the blueprint, as the paint stains do, and a tap passes through them to the part.
export function CutawayRotStains({ boxes, thermal, color = CUTAWAY_FLOW_COLORS.rot, alpha = CUTAWAY_ROT.stain.alpha }: CutawayRotStainsProps) {
  const geometry = useOwnedGeometry(() => tintVertices(mergeBoxes(boxes), color, 0, 1, alpha), [boxes, color, alpha])
  return (
    <group visible={!thermal} userData={BLUEPRINT_OMIT_TAG}>
      <mesh geometry={geometry} raycast={ignoreRaycast} renderOrder={STAIN_ORDER} receiveShadow>
        <meshStandardMaterial vertexColors alphaMap={rotStainTexture()} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  )
}
