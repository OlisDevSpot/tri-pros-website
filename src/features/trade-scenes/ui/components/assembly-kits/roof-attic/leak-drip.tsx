'use client'

import type { Mesh } from 'three'
import type { RibbonPoint } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useRef } from 'react'

import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { KIT_DRIP } from '@/features/trade-scenes/constants/roof-attic-flows'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'

interface LeakDripProps {
  /** Under the ceiling, where the rain that got past it gathers. */
  at: RibbonPoint
  burst: SceneBurst
}

const { drip } = LEAK
const RADIUS = drip.radius * KIT_DRIP.scale
const GATHER = drip.gather

// The home's drip, at section scale: drops gather and fall at a steady rate for the whole burst, and at rest a full drop hangs
// on the ceiling.
export function LeakDrip({ at, burst }: LeakDripProps) {
  const drop = useRef<Mesh>(null)
  const phase = useRef(0)
  const [x, y, z] = at
  const top = y - RADIUS

  useBurstMotion(burst, (life, seconds) => {
    const next = phase.current + seconds / drip.periodSeconds
    // Late in the burst a finished period restarts at zero rather than carrying its overshoot; the rate never slows.
    phase.current = next >= 1 && life < 0.5 ? 0 : next % 1
    const resting = life === 0 && seconds === 0
    const falling = resting ? 0 : Math.max(0, (phase.current - GATHER) / (1 - GATHER))
    const growing = resting ? 1 : Math.min(1, phase.current / GATHER)
    if (drop.current) {
      drop.current.position.y = top - KIT_DRIP.fall * falling * falling
      drop.current.scale.setScalar(0.4 + 0.6 * growing)
    }
  })

  return (
    <mesh ref={drop} position={[x, top, z]}>
      <sphereGeometry args={[RADIUS, 12, 8]} />
      <meshStandardMaterial color={drip.color} roughness={0.1} />
    </mesh>
  )
}
