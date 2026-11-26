'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { HOME_MATERIALS_COPY, MINI_SPLIT_HEAD_COUNT_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { miniSplitHeadCount } from '@/features/trade-scenes/lib/mini-split-head-count'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { miniSplitHeadCounts } from '@/shared/modules/construction/core/constants/enums'

export function MiniSplitHeadCountChoice() {
  const count = useSceneInputs((state: TradeSceneInputs) => miniSplitHeadCount(state.homeMaterials, 'proposed'))
  const applyChange = useApplySceneChange()

  return (
    <div className="grid w-full gap-2">
      <span className={CONTROLS_CLASSES.capsLabel}>{HOME_MATERIALS_COPY.miniSplitHeads}</span>
      <ChoicePill
        label={HOME_MATERIALS_COPY.miniSplitHeads}
        value={count}
        options={miniSplitHeadCounts}
        labels={MINI_SPLIT_HEAD_COUNT_LABELS}
        onChange={count => applyChange({ kind: 'fact', patch: { proposedMiniSplitHeads: count } })}
      />
    </div>
  )
}
