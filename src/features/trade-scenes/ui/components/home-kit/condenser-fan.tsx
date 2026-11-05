'use client'

import type { Group } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useRef } from 'react'

import { CONDENSER_FAN, EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'

interface CondenserFanProps {
  load: number
  burst: SceneBurst
}

const BLADE_ANGLES = Array.from({ length: CONDENSER_FAN.blades }, (_, index) => (index / CONDENSER_FAN.blades) * Math.PI * 2)

// The pack's condenser has its grille baked in, so the blades are drawn in front of it; they spin with the load.
export function CondenserFan({ load, burst }: CondenserFanProps) {
  const rotor = useRef<Group>(null)
  useBurstMotion(burst, (life, seconds) => {
    if (rotor.current) {
      rotor.current.rotation.z += seconds * EQUIPMENT_STRAIN.fanTurnsPerSecond * load * life * Math.PI * 2
    }
  })

  return (
    <group position={[...CONDENSER_FAN.position]} rotation={[0, CONDENSER_FAN.rotationY, 0]}>
      <group ref={rotor}>
        {BLADE_ANGLES.map(angle => (
          <mesh key={angle} rotation={[0, 0, angle]} position={[Math.cos(angle) * CONDENSER_FAN.radius * 0.5, Math.sin(angle) * CONDENSER_FAN.radius * 0.5, 0]}>
            <boxGeometry args={[CONDENSER_FAN.radius, 0.06, 0.008]} />
            <meshStandardMaterial color={CONDENSER_FAN.blade} roughness={0.7} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
          <meshStandardMaterial color={CONDENSER_FAN.hub} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}
