'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { PAINT_WEAR_LABELS, PAINT_WEAR_LEVEL_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { paintWearInForce } from '@/features/trade-scenes/lib/paint-wear-in-force'
import { ScaleField } from '@/features/trade-scenes/ui/components/fields/scale-field'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { paintWearKinds, paintWearLevels } from '@/shared/modules/construction/core/constants/enums'
import { wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

export function PaintWearFields() {
  const recorded = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.paintWear)
  const material = useSceneTargets().home['exterior-paint']
  const applyChange = useApplySceneChange()
  if (!material || wearInForce(material) === 'new') {
    return null
  }
  const levels = paintWearInForce(material, recorded)

  return paintWearKinds.map(kind => (
    <ScaleField
      key={kind}
      label={PAINT_WEAR_LABELS[kind]}
      value={levels[kind]}
      options={paintWearLevels}
      labels={PAINT_WEAR_LEVEL_LABELS}
      onChange={level => applyChange({ kind: 'fact', patch: { paintWear: { ...recorded, [kind]: level } } })}
    />
  ))
}
