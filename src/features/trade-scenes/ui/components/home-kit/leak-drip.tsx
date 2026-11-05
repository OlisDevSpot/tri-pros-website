'use client'

import type { Mesh } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useRef } from 'react'

import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'

interface LeakDripProps {
  burst: SceneBurst
}

const { spot: [x, z], ceilingY, floorY, bucket, drip } = LEAK
const WATER_Y = floorY + bucket.height * bucket.waterLine
const FALL = ceilingY - drip.radius - WATER_Y
const GATHER = drip.gather

// Drips gather and fall at a steady rate for the whole burst; when it ends, a full drop sits on the ceiling, which is the rest pose.
export function LeakDrip({ burst }: LeakDripProps) {
  const drop = useRef<Mesh>(null)
  const phase = useRef(0)

  useBurstMotion(burst, (life, seconds) => {
    const next = phase.current + seconds / drip.periodSeconds
    // Late in the burst a finished period restarts at zero rather than carrying its overshoot; the rate never slows.
    phase.current = next >= 1 && life < 0.5 ? 0 : next % 1
    const resting = life === 0 && seconds === 0
    const falling = resting ? 0 : Math.max(0, (phase.current - GATHER) / (1 - GATHER))
    const growing = resting ? 1 : Math.min(1, phase.current / GATHER)
    if (drop.current) {
      drop.current.position.y = ceilingY - drip.radius - FALL * falling * falling
      drop.current.scale.setScalar(0.4 + 0.6 * growing)
    }
  })

  return (
    <mesh ref={drop} position={[x, ceilingY - drip.radius, z]}>
      <sphereGeometry args={[drip.radius, 12, 8]} />
      <meshStandardMaterial color={drip.color} roughness={0.1} />
    </mesh>
  )
}
