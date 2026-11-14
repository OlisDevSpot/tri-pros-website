'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'

import { ROOMS } from '@/features/trade-scenes/constants/home-geometry'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface HvacClosetProps {
  // A placement's own list, so it never rebuilds the walls.
  walls: readonly BoxSpec[]
}

// Painted as the living room it stands in. Drawn whether a unit stands in it or a build has moved the unit to the attic.
export function HvacCloset({ walls }: HvacClosetProps) {
  if (walls.length === 0) {
    return null
  }
  return (
    <group userData={thermalTag('interior')}>
      <MergedBoxes boxes={walls} color={ROOMS.living.paint} radius={0.008} />
    </group>
  )
}
