'use client'

import type { Group } from 'three'

import { useEffect, useMemo, useRef } from 'react'

import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { createRadialTexture } from '@/features/trade-scenes/ui/lib/create-radial-texture'
import { useEased } from '@/shared/components/scene/hooks/use-eased'

interface LeakStainProps {
  /** Share of the rain that gets into the room. */
  reachesInside: number
  /** Top of whatever lies on the ceiling (the insulation), where the soak shows from above. */
  topY: number
}

const { spot: [x, z], ceilingY, stain } = LEAK

// A water mark: a pale soak inside a darker tide line. It spreads to the share of the rain the walk lets in, under the
// ceiling for anyone looking up and on the soaked insulation for the camera looking down into the attic.
export function LeakStain({ reachesInside, topY }: LeakStainProps) {
  const texture = useMemo(() => createRadialTexture([
    [0, `${stain.fill}88`],
    [0.72, `${stain.fill}aa`],
    [0.88, `${stain.rim}dd`],
    [1, `${stain.rim}00`],
  ]), [])
  useEffect(() => () => texture.dispose(), [texture])
  const spread = useRef<Group>(null)

  useEased(Math.max(reachesInside, 0) * LEAK.stainRadius, (radius) => {
    // A zero scale makes a singular matrix; a hair's width reads as nothing.
    const size = Math.max(radius * 2, 0.001)
    spread.current?.scale.set(size, 1, size)
  })

  return (
    <group ref={spread} position={[x, 0, z]} scale={[0.001, 1, 0.001]}>
      <mesh position={[0, ceilingY - 0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh position={[0, topY + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  )
}
