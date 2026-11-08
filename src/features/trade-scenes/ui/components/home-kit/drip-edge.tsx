'use client'

import type { PartState } from '@/features/trade-scenes/lib/part-state'

import { useMemo } from 'react'
import { Color } from 'three'

import { dripEdgeBoxes } from '@/features/trade-scenes/lib/drip-edge-boxes'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { coveringTone } from '@/features/trade-scenes/ui/lib/covering-tone'

interface DripEdgeProps {
  /** The run along the eave, in the slope's own z. */
  zFrom: number
  zTo: number
  /** The run's real roof edges, which carry a rake. */
  ends: readonly ('from' | 'to')[]
  dripEdge: PartState
  covering: PartState
  shingleTone: string | null
}

// It is painted to match the roof and ages with it, but it sits a step darker in its own shadow under the first course, so
// the edge still reads as its own piece. A working number, settled by screenshot.
const SHADE = 0.8

export function DripEdge({ zFrom, zTo, ends, dripEdge, covering, shingleTone }: DripEdgeProps) {
  const boxes = useMemo(() => dripEdgeBoxes(zFrom, zTo, ends), [zFrom, zTo, ends])
  if (dripEdge.material === null) {
    return null
  }
  const colour = `#${new Color(coveringTone(covering.material, 'shingle', covering.wear, shingleTone)).multiplyScalar(SHADE).getHexString()}`
  return (
    <group userData={thermalTag(null, 'drip-edge')}>
      <group userData={systemPartTag('drip-edge')}>
        {/* Painted metal: smoother than the shingles' granules, but far less metallic than bare sheet. */}
        <MergedBoxes boxes={boxes} color={colour} roughness={0.45} metalness={0.15} />
      </group>
    </group>
  )
}
