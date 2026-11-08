'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { WindowFrameColorId } from '@/shared/modules/construction/core/constants/window-frame-colors'

import { FRAME_COLOR_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { WINDOW_FRAME_COLOR_IDS, WINDOW_FRAME_COLORS } from '@/shared/modules/construction/core/constants/window-frame-colors'

// Object.fromEntries widens its keys to string; the list holds every frame colour.
const LABELS = Object.fromEntries(WINDOW_FRAME_COLOR_IDS.map(id => [id, WINDOW_FRAME_COLORS[id].name])) as Record<WindowFrameColorId, string>

export function FrameColors() {
  const value = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.windowFrameColor)
  const applyChange = useApplySceneChange()
  return (
    <ChoicePill
      label={FRAME_COLOR_COPY.label}
      value={value}
      options={WINDOW_FRAME_COLOR_IDS}
      labels={LABELS}
      onChange={windowFrameColor => applyChange({ kind: 'fact', patch: { windowFrameColor } })}
    />
  )
}
