'use client'

import type { RotSpot } from '@/features/trade-scenes/lib/ribbon-paths'

import { KIT_ROT } from '@/features/trade-scenes/constants/roof-attic-flows'

interface RotPatchProps {
  spot: RotSpot
  /** Share of the rain the part soaked up. */
  soaked: number
}

// A dark rot stain where the rain crosses a part it soaks, wider the more it soaks; drawn inside the part, so it peels with it.
export function RotPatch({ spot, soaked }: RotPatchProps) {
  const radius = KIT_ROT.radius * soaked
  return (
    <group position={spot.position} rotation={[0, 0, spot.tilt]}>
      <mesh>
        <cylinderGeometry args={[radius, radius, spot.thickness, KIT_ROT.segments]} />
        <meshStandardMaterial color={KIT_ROT.color} roughness={1} />
      </mesh>
    </group>
  )
}
