'use client'

import { MATERIAL_COLORS, SCENE } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { DRYWALL } from '@/features/meeting-visualizations/ui/components/roof-cutaway/attic-floor'
import { Slab } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

/** Not a layer: two wall stubs under the eaves so the slice reads as part of a house. */
export function WallStubs() {
  return (
    <>
      {([-1, 1] as const).map(side => (
        <Slab
          key={side}
          size={[0.16, SCENE.wallHeight, SCENE.depth]}
          position={[side * (SCENE.halfSpan - 0.08), -SCENE.wallHeight / 2 - DRYWALL, 0]}
          color={MATERIAL_COLORS.wall}
          roughness={0.95}
        />
      ))}
    </>
  )
}
