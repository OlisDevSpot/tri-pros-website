'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { roomAt } from '@/features/trade-scenes/lib/room-at'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface HvacClosetProps {
  // A placement's own list, so it never rebuilds the walls.
  walls: readonly BoxSpec[]
}

// Painted as the room it stands in, so it moves rooms with its placement. Drawn whether a unit stands in it or a build has
// moved the unit to the attic.
export function HvacCloset({ walls }: HvacClosetProps) {
  const paint = useMemo(() => {
    const ends = walls.flatMap(({ size, position }) => [position[0] - size[0] / 2, position[0] + size[0] / 2])
    return roomAt((Math.min(...ends) + Math.max(...ends)) / 2).paint
  }, [walls])
  if (walls.length === 0) {
    return null
  }
  return (
    <group userData={thermalTag('interior')}>
      <MergedBoxes boxes={walls} color={paint} radius={0.008} />
    </group>
  )
}
