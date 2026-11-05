'use client'

import type { Group, MeshBasicMaterial } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { Billboard } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color } from 'three'

import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { createRadialTexture } from '@/features/trade-scenes/ui/lib/create-radial-texture'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface HeatShimmerProps {
  position: readonly [number, number, number]
  load: number
  burst: SceneBurst
}

const { shimmer } = EQUIPMENT_STRAIN
const BASE = new Color(shimmer.color)

// Hot air over a unit running hard. The haze is a state, so it stays at rest in proportion to the load; only its sway is
// burst motion. Additive, and dimmed by colour rather than opacity, so the ghost's fade keeps working on it.
export function HeatShimmer({ position, load, burst }: HeatShimmerProps) {
  // Added light, so black adds nothing: the haze fades out to its edge by colour alone.
  const texture = useMemo(() => createRadialTexture([[0, '#ffffff'], [0.55, '#5a5a5a'], [1, '#000000']]), [])
  useEffect(() => () => texture.dispose(), [texture])
  const material = useRef<MeshBasicMaterial>(null)
  const sway = useRef<Group>(null)
  const phase = useRef(0)

  useEased(load * shimmer.strength, (value) => {
    material.current?.color.copy(BASE).multiplyScalar(value)
  })
  useBurstMotion(burst, (life, seconds) => {
    phase.current += seconds * shimmer.swayHz * Math.PI * 2
    if (sway.current) {
      sway.current.position.x = shimmer.swayMetres * life * Math.sin(phase.current)
      sway.current.scale.y = 1 + 0.12 * life * Math.sin(phase.current * 1.7)
    }
  })

  return (
    <group position={[...position]}>
      <group ref={sway}>
        <Billboard>
          <mesh raycast={ignoreRaycast}>
            <planeGeometry args={[...shimmer.size]} />
            <meshBasicMaterial ref={material} color="#000000" map={texture} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>
    </group>
  )
}
