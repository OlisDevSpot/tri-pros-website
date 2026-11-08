'use client'

import type { ThermalTagData } from '@/features/trade-scenes/lib/thermal-tag'
import type { BoxSpec, SystemLit, SystemPartId } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { clipBoxes, stepBottom, stepStarts } from '@/features/trade-scenes/lib/step-cut-back'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface AtticStepsProps {
  part: SystemPartId
  // The system up close, which steps this part open when it is one of its steps.
  lit: SystemLit | null
  thermal: Readonly<ThermalTagData>
  // Memoized or module-level: a new list rebuilds the geometry.
  boxes: readonly BoxSpec[]
  color: string
  radius?: number
  roughness?: number
  castShadow?: boolean
}

// One box-built system part laid flat across the house: the attic's blanket or joists, the ceiling under them, or a flat
// roof's system parts, which lie straight over its joist space. Stepped, it starts a step past the cut and shows nothing
// back to the cut; what lies the far side of the cut drops its tag, so it takes the ghost with the rest of the house. The
// bottom step never moves, so it stays whole. It reads the peel itself, so a drag redraws only this part.
export function AtticSteps({ part, lit, thermal, boxes, color, radius, roughness, castShadow }: AtticStepsProps) {
  const peel = useStepPeel(lit)
  const start = lit === null ? undefined : stepStarts(lit.system, lit.shown, peel).get(part)
  const split = start !== undefined && lit !== null && stepBottom(lit.shown) !== part
  const rest = useMemo(() => split ? clipBoxes(boxes, 0, -Infinity, HOUSE.cutX) : [], [boxes, split])
  const shown = useMemo(() => split ? clipBoxes(boxes, 0, start, Infinity) : boxes, [boxes, split, start])
  const look = { color, radius, roughness, castShadow }
  return (
    <group userData={thermal}>
      {rest.length > 0 && <MergedBoxes boxes={rest} {...look} />}
      {shown.length > 0 && (
        <group userData={systemPartTag(part)}>
          <MergedBoxes boxes={shown} {...look} />
        </group>
      )}
    </group>
  )
}
