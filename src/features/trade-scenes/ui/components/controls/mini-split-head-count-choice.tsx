'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { HOME_MATERIALS_COPY, MINI_SPLIT_HEAD_COUNT_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { miniSplitHeadCounts } from '@/shared/modules/construction/core/constants/enums'

// The build's heads keep the home's own count until the rep picks another.
export function MiniSplitHeadCountChoice() {
  const existing = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.miniSplitHeads)
  const proposed = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.proposedMiniSplitHeads)
  const applyChange = useApplySceneChange()

  return (
    <div className="grid w-full gap-2">
      <span className={CONTROLS_CLASSES.capsLabel}>{HOME_MATERIALS_COPY.miniSplitHeads}</span>
      <ChoicePill
        label={HOME_MATERIALS_COPY.miniSplitHeads}
        value={proposed ?? existing}
        options={miniSplitHeadCounts}
        labels={MINI_SPLIT_HEAD_COUNT_LABELS}
        onChange={count => applyChange({ kind: 'fact', patch: { proposedMiniSplitHeads: count } })}
      />
    </div>
  )
}
