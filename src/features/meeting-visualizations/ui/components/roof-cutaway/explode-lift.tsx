'use client'

import type { ReactNode } from 'react'
import type { Group } from 'three'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useCutawayMotion } from '@/features/meeting-visualizations/ui/components/roof-cutaway/cutaway-motion'

/** Raises the whole roof as the slider opens, so the attic shows between the rafters and the joists. */
export function ExplodeLift({ amount, children }: { amount: number, children: ReactNode }) {
  const { explode } = useCutawayMotion()
  const group = useRef<Group>(null)
  useFrame(() => {
    if (group.current)
      group.current.position.y = explode.current * amount
  })
  return <group ref={group}>{children}</group>
}
