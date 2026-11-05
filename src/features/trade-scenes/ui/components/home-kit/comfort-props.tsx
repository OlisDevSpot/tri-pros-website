'use client'

import type { Group } from 'three'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useRef } from 'react'

import { CEILING_FAN_PLACEMENT } from '@/features/trade-scenes/constants/home-furnishings'
import { CEILING_FAN_TURNS_PER_SECOND } from '@/features/trade-scenes/constants/home-life'
import { FurniturePiece } from '@/features/trade-scenes/ui/components/home-kit/furniture-piece'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'

interface ComfortPropsProps {
  /** Hot residents: the ceiling fan turns. */
  fanning: boolean
  burst: SceneBurst
}

const AT_ORIGIN = { ...CEILING_FAN_PLACEMENT, position: [0, 0, 0] as const }

// The props the residents' comfort sets in motion around them; the blankets travel with the residents themselves.
export function ComfortProps({ fanning, burst }: ComfortPropsProps) {
  const fan = useRef<Group>(null)
  useBurstMotion(burst, (life, seconds) => {
    if (fan.current && fanning) {
      fan.current.rotation.y += seconds * CEILING_FAN_TURNS_PER_SECOND * life * Math.PI * 2
    }
  })

  return (
    <group position={[...CEILING_FAN_PLACEMENT.position]}>
      <group ref={fan}>
        <FurniturePiece placement={AT_ORIGIN} />
      </group>
    </group>
  )
}
