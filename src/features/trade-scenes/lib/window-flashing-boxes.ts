import type { WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import type { BoxSpec } from '@/features/trade-scenes/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { LOOK_INSIDE_WINDOW } from '@/features/trade-scenes/constants/look-inside'
import { WINDOW_SEAL_LOOKS } from '@/features/trade-scenes/constants/system-part-looks'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'

const { wall, opening } = LOOK_INSIDE_WINDOW
const LEFT = opening.along - opening.width / 2
const RIGHT = opening.along + opening.width / 2
const SILL = HOUSE.floorY + opening.sill
const HEAD = HOUSE.floorY + opening.head
// The flashing stands this far inside every face of the frame, clear of the 1 cm the frame's boxes are rounded by, so while
// the window is whole no edge of it shares a face with the frame or shows through a rounded corner, even through the ghosted
// wall. A working number.
const TUCK = 0.012

// The flashing lining the opening the frame sits in, under its bars: a membrane round the head, the sill and both jambs, from
// just behind the frame's outer face through its depth. Whole, the frame hides it; pulled apart, it shows in the opening.
export function flashingBoxes(frame: (typeof WINDOW_FRAMES)[keyof typeof WINDOW_FRAMES]): BoxSpec[] {
  const { thickness } = WINDOW_SEAL_LOOKS.flashing
  const [left, right, sill, head] = [LEFT + TUCK, RIGHT - TUCK, SILL + TUCK, HEAD - TUCK]
  const lining = (along: readonly [number, number], height: readonly [number, number]) => wallBox(wall, along, height, 0, frame.depth - 2 * TUCK)
  return [
    lining([left, right], [head - thickness, head]),
    lining([left, right], [sill, sill + thickness]),
    lining([left, left + thickness], [sill + thickness, head - thickness]),
    lining([right - thickness, right], [sill + thickness, head - thickness]),
  ]
}
