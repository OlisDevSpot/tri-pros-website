'use client'

import type { MeshBasicMaterial } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useEffect, useMemo, useRef } from 'react'

import { THERMOSTAT_DISPLAY } from '@/features/trade-scenes/constants/home-life'
import { createThermostatTexture } from '@/features/trade-scenes/ui/lib/create-thermostat-texture'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'

interface ThermostatDisplayProps {
  position: readonly [number, number, number]
  setpoint: number
  /** Calling for air: the running mark shows, in the colour of what it calls for. */
  running: 'summer' | 'winter' | null
  burst: SceneBurst
}

const { face: FACE, markRadius: MARK_RADIUS } = THERMOSTAT_DISPLAY

// The setpoint and, while the equipment strains, a running mark that pulses during a burst and holds steady at rest.
export function ThermostatDisplay({ position, setpoint, running, burst }: ThermostatDisplayProps) {
  const texture = useMemo(() => createThermostatTexture(setpoint), [setpoint])
  useEffect(() => () => texture.dispose(), [texture])
  const mark = useRef<MeshBasicMaterial>(null)
  const phase = useRef(0)

  useBurstMotion(burst, (life, seconds) => {
    phase.current += seconds * THERMOSTAT_DISPLAY.pulseHz * Math.PI * 2
    // Dimmed by colour, not opacity, which the ghost's fade owns while the home is zoomed past.
    if (mark.current && running !== null) {
      mark.current.color.set(THERMOSTAT_DISPLAY.running[running]).multiplyScalar(1 - 0.6 * life * (0.5 + 0.5 * Math.sin(phase.current)))
    }
  })

  return (
    <group position={[...position]}>
      <mesh>
        <planeGeometry args={[...FACE]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
      {running !== null && (
        <mesh position={[FACE[0] / 2 - MARK_RADIUS * 1.8, FACE[1] / 2 - MARK_RADIUS * 1.8, 0.001]}>
          <circleGeometry args={[MARK_RADIUS, 16]} />
          <meshBasicMaterial ref={mark} color={THERMOSTAT_DISPLAY.running[running]} transparent toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
