import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { WindowFrameColorId } from '@/shared/modules/construction/core/constants/window-frame-colors'

import { FRAME_LOOKS, ORIGINAL_FRAME_LOOK } from '@/features/trade-scenes/constants/system-part-looks'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { WINDOW_FRAME_COLORS } from '@/shared/modules/construction/core/constants/window-frame-colors'

interface WindowFrameLook {
  outside: string
  inside: string
  roughness: number
  metalness: number
}

// Only the build installs a vinyl frame, so only it takes the pick; a home's own frame keeps its look and its wear, and
// reads the same from both sides.
export function windowFrameLook(frame: PartState, double: boolean, picked: WindowFrameColorId): WindowFrameLook {
  if (frame.material === 'vinyl-frame') {
    const { outside, inside } = WINDOW_FRAME_COLORS[picked]
    const { roughness, metalness } = FRAME_LOOKS.vinyl
    return { outside, inside, roughness, metalness }
  }
  const look = FRAME_LOOKS[ORIGINAL_FRAME_LOOK[double ? 'double-pane' : 'single-pane']]
  const color = wornColor(look.color, WEAR_LOOKS.window.frame, frame.wear)
  return { outside: color, inside: color, roughness: look.roughness, metalness: look.metalness }
}
