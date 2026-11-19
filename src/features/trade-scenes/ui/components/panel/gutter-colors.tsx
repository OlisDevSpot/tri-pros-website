'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { GutterColorId } from '@/shared/modules/construction/core/constants/gutter-colors'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, GUTTER_COLOR_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ColorSwatches } from '@/features/trade-scenes/ui/components/panel/color-swatches'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { GUTTER_COLORS } from '@/shared/modules/construction/core/constants/gutter-colors'

// The proposed gutters match the existing ones until the rep picks another colour. The name sits in the label because a
// swatch's title never shows on an iPad.
export function GutterColors({ side }: { side: 'existing' | 'proposed' }) {
  const existing = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.existingGutterColor)
  const proposed = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.proposedGutterColor)
  const applyChange = useApplySceneChange()
  const value = side === 'existing' ? existing : proposed ?? existing
  const name = value === null ? GUTTER_COLOR_COPY.notPicked : GUTTER_COLORS.find(color => color.id === value)!.name
  const onPick = (id: GutterColorId) => applyChange({ kind: 'fact', patch: side === 'existing' ? { existingGutterColor: id } : { proposedGutterColor: id } })

  return (
    <div className="grid w-full gap-2">
      <span className={CONTROLS_CLASSES.capsLabel}>{`${GUTTER_COLOR_COPY.label}${CONTROLS_COPY.systems.valueJoin}${name}`}</span>
      <ColorSwatches label={GUTTER_COLOR_COPY.label} colors={GUTTER_COLORS} value={value} onPick={onPick} />
    </div>
  )
}
