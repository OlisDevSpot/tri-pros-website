'use client'

import { KIT_COLORS, KIT_PENETRATIONS } from '@/features/trade-scenes/constants/roof-attic-kit'

// Foam collars where the light's can and the vent pipe come through the ceiling: the gaps closed before insulation goes down.
export function AirSealingPart() {
  const { light, pipe, collar } = KIT_PENETRATIONS
  return (
    <>
      {[{ at: light.at, radius: light.radius * 1.1 }, { at: pipe.at, radius: pipe.radius }].map(({ at, radius }) => (
        <mesh key={at.join(',')} position={[at[0], collar.height / 2, at[1]]}>
          <cylinderGeometry args={[radius + collar.reach, radius + collar.reach * 1.4, collar.height, 20]} />
          <meshStandardMaterial color={KIT_COLORS.foam} roughness={1} />
        </mesh>
      ))}
    </>
  )
}
