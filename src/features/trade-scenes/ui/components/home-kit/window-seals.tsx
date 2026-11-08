'use client'

import type { WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, SystemLit, SystemPartId } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { LOOK_INSIDE_WINDOW, LOOK_INSIDE_WINDOW_TAG, PART_PIECES } from '@/features/trade-scenes/constants/look-inside'
import { WINDOW_SEAL_LOOKS } from '@/features/trade-scenes/constants/system-part-looks'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'
import { flashingBoxes } from '@/features/trade-scenes/lib/window-flashing-boxes'
import { windowSpread } from '@/features/trade-scenes/lib/window-spread'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

type PieceId = keyof typeof WINDOW_SEAL_LOOKS

interface WindowSealsProps {
  frame: PartState
  // The frame's bars and depth: the seals bead its outer face, the flashing lines the opening under its bars.
  size: (typeof WINDOW_FRAMES)[keyof typeof WINDOW_FRAMES]
  // Windows up close.
  lit: SystemLit
}

const { wall, opening } = LOOK_INSIDE_WINDOW
const LEFT = opening.along - opening.width / 2
const RIGHT = opening.along + opening.width / 2
const SILL = HOUSE.floorY + opening.sill
const HEAD = HOUSE.floorY + opening.head

// A bead round the frame just inside the opening, on the frame's outer face.
function sealBoxes(depth: number): BoxSpec[] {
  const { width, thickness } = WINDOW_SEAL_LOOKS.seals
  const bead = (along: readonly [number, number], height: readonly [number, number]) => wallBox(wall, along, height, depth / 2 + thickness / 2, thickness)
  return [
    bead([LEFT, RIGHT], [HEAD - width, HEAD]),
    bead([LEFT, RIGHT], [SILL, SILL + width]),
    bead([LEFT, LEFT + width], [SILL + width, HEAD - width]),
    bead([RIGHT - width, RIGHT], [SILL + width, HEAD - width]),
  ]
}

// The framed window's seals and flashing, each drawn once where it stands at rest, the seals then moved out as far as the
// pull moves them; the flashing stays against the wall. It reads the pull itself, so a drag moves only its pieces.
export function WindowSeals({ frame, size, lit }: WindowSealsProps) {
  const pull = useStepPeel(lit)
  const pieces = useMemo(() => PART_PIECES.frame.filter(id => lit.shown.has(id)).map((id): { id: SystemPartId, boxes: BoxSpec[] } => ({
    id,
    boxes: id === 'seals' ? sealBoxes(size.depth) : flashingBoxes(size),
  })), [size, lit.shown])
  const spread = windowSpread(lit.shown, pull)
  return (
    <>
      {pieces.map(({ id, boxes }) => {
        const look = WINDOW_SEAL_LOOKS[id as PieceId]
        return (
          <group key={id} position={[...spread.get(id)!]} userData={systemPartTag(id, LOOK_INSIDE_WINDOW_TAG)}>
            <MergedBoxes boxes={boxes} color={wornColor(look.color, look.worn, frame.wear)} />
          </group>
        )
      })}
    </>
  )
}
