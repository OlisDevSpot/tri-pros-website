'use client'

import type { BoxSpec, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { MINI_SPLIT_HEAD_SIZE, MINI_SPLIT_HEADS, MINI_SPLIT_LINE_SIZE } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { homeFloorY } from '@/features/trade-scenes/lib/home-floor-y'
import { runningZone } from '@/features/trade-scenes/lib/hvac-running'
import { lineSetBoxes, miniSplitLineSet } from '@/features/trade-scenes/lib/mini-split-line-set'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface MiniSplitHeadsProps {
  heads: number
  running: boolean
  side: 'heating' | 'cooling' | null
}

const HEADS_TAG = systemPartTag('mini-split-heads')
const LINES_TAG = systemPartTag('mini-split-outdoor')

const [ALONG, HEIGHT, OUT] = MINI_SPLIT_HEAD_SIZE
// The body, and the slot along the bottom of its face that the air leaves by. Working numbers, set by screenshot.
function headBoxes(count: number): { bodies: BoxSpec[], slots: BoxSpec[] } {
  const placed = MINI_SPLIT_HEADS.slice(0, count)
  return {
    bodies: placed.map(({ position: [x, y, z], outward }) => ({ size: MINI_SPLIT_HEAD_SIZE, position: [x, y, z - outward * OUT / 2] })),
    slots: placed.map(({ position: [x, y, z], outward }) => ({ size: [ALONG * 0.84, 0.035, 0.01], position: [x, y - HEIGHT * 0.3, z - outward * (OUT + 0.003)] })),
  }
}

// One list per count, built once, so a change of count swaps lists instead of rebuilding them each render.
const HEADS_BY_COUNT = MINI_SPLIT_HEADS.map((_, index) => headBoxes(index + 1))

function selectFoundation(state: TradeSceneInputs) {
  return state.property.foundationType
}

// A head high on each room's wall, and the lines from the outdoor unit to each, in a cover up the left wall and along the
// back. The heads read as the air they blow while they run; the lines, as the air outside.
export function MiniSplitHeads({ heads, running, side }: MiniSplitHeadsProps) {
  const count = Math.min(Math.max(heads, 1), MINI_SPLIT_HEADS.length)
  const { bodies, slots } = HEADS_BY_COUNT[count - 1]
  const floorY = homeFloorY(useSceneInputs(selectFoundation))
  const lines = useMemo(() => lineSetBoxes(miniSplitLineSet(count, floorY), MINI_SPLIT_LINE_SIZE), [count, floorY])
  return (
    <group>
      <group userData={thermalTag(runningZone(running, side, 'interior'))}>
        <group userData={HEADS_TAG}>
          <MergedBoxes boxes={bodies} color={HOME_PALETTE.unit} radius={0.04} roughness={0.5} castShadow />
          <MergedBoxes boxes={slots} color={HOME_PALETTE.unitGrille} roughness={0.8} />
        </group>
      </group>
      <group userData={thermalTag(runningZone(running, side, 'exterior'))}>
        <group userData={LINES_TAG}>
          <MergedBoxes boxes={lines} color={HOME_PALETTE.unit} radius={0.01} roughness={0.7} />
        </group>
      </group>
    </group>
  )
}
