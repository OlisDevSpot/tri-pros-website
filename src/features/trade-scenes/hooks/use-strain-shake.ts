'use client'

import type { RefObject } from 'react'
import type { Group } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useRef } from 'react'

import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'

// A unit running hard rattles in place during a burst, as hard as its load; at rest it sits still where it stands.
export function useStrainShake(load: number, burst: SceneBurst): RefObject<Group | null> {
  const group = useRef<Group>(null)
  const phase = useRef(0)
  useBurstMotion(burst, (life, seconds) => {
    phase.current += seconds * EQUIPMENT_STRAIN.shake.hz * Math.PI * 2
    const reach = EQUIPMENT_STRAIN.shake.metres * load * life
    group.current?.position.set(reach * Math.sin(phase.current), 0, reach * Math.cos(phase.current * 1.37))
  })
  return group
}
