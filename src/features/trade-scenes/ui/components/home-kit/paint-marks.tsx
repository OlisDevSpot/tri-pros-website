'use client'

import type { TintedBoxes } from '@/features/trade-scenes/types'

import { BufferGeometry } from 'three'

import { BLUEPRINT_OMIT_TAG } from '@/features/trade-scenes/constants/scene-load'
import { mergeTintedBoxes } from '@/features/trade-scenes/ui/lib/vertex-tinted-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface PaintMarksProps {
  // Callers pass a memoized list: a new array rebuilds the geometry.
  lists: readonly TintedBoxes[]
  thermal: boolean
}

// The opaque marks on a painted surface, in one draw. The Thermal lens paints temperatures and a mark is none, so they step aside
// under it: a group flag, since the view fades write each mesh's own. They stay out of the blueprint, which draws the clean house,
// and a tap passes through them to the wall.
export function PaintMarks({ lists, thermal }: PaintMarksProps) {
  // An empty geometry stands in when there is nothing to draw, so the hook always has one to own.
  const geometry = useOwnedGeometry(() => mergeTintedBoxes(lists) ?? new BufferGeometry(), [lists])
  if (!geometry.hasAttribute('position')) {
    return null
  }
  return (
    <group visible={!thermal} userData={BLUEPRINT_OMIT_TAG}>
      <mesh geometry={geometry} raycast={ignoreRaycast} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
    </group>
  )
}
