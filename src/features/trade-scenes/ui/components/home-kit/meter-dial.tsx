'use client'

import type { Group } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useRef } from 'react'

import { METER_DIAL } from '@/features/trade-scenes/constants/home-life'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'

interface MeterDialProps {
  position: readonly [number, number, number]
  /** 0..1 */
  speed: number
  burst: SceneBurst
}

// A disc facing out of the side wall (−x) with a mark on it, turning as fast as the bill runs; at rest it stops where it is.
export function MeterDial({ position, speed, burst }: MeterDialProps) {
  const disc = useRef<Group>(null)
  useBurstMotion(burst, (life, seconds) => {
    if (disc.current) {
      disc.current.rotation.x += seconds * METER_DIAL.turnsPerSecond * speed * life * Math.PI * 2
    }
  })

  return (
    <group position={[...position]}>
      <group ref={disc}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[METER_DIAL.radius, METER_DIAL.radius, 0.006, 24]} />
          <meshStandardMaterial color={HOME_PALETTE.meterDial} roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh position={[-0.004, METER_DIAL.radius * 0.55, 0]}>
          <boxGeometry args={[0.004, METER_DIAL.radius * 0.8, 0.018]} />
          <meshStandardMaterial color={HOME_PALETTE.meterMark} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}
