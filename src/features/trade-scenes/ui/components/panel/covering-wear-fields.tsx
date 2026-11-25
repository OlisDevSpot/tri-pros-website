'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { COVERING_WEAR_KINDS_BY_ROOF } from '@/features/trade-scenes/constants/covering-wear'
import { COVERING_WEAR_LABELS, PAINT_WEAR_LEVEL_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { coveringWearInForce } from '@/features/trade-scenes/lib/covering-wear-in-force'
import { ScaleField } from '@/features/trade-scenes/ui/components/fields/scale-field'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { paintWearLevels } from '@/shared/modules/construction/core/constants/enums'
import { wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

export function CoveringWearFields() {
  const recorded = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.coveringWear)
  const roofType = useSceneInputs((state: TradeSceneInputs) => state.property.roofType ?? 'shingle')
  const material = useSceneTargets().home.roof
  const applyChange = useApplySceneChange()
  if (!material || wearInForce(material) === 'new') {
    return null
  }
  const levels = coveringWearInForce(material, recorded, roofType)

  return COVERING_WEAR_KINDS_BY_ROOF[roofType].map(kind => (
    <ScaleField
      key={kind}
      label={COVERING_WEAR_LABELS[kind]}
      value={levels[kind]}
      options={paintWearLevels}
      labels={PAINT_WEAR_LEVEL_LABELS}
      onChange={level => applyChange({ kind: 'fact', patch: { coveringWear: { ...recorded, [kind]: level } } })}
    />
  ))
}
