'use client'

import type { MaterialInputGroupId } from '@/features/trade-scenes/lib/material-input-groups'
import type { SceneChangeSlot } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { HOME_MATERIAL_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ratedMaterial, ridingSlot } from '@/features/trade-scenes/lib/material-input-groups'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { CoveringWearFields } from '@/features/trade-scenes/ui/components/panel/covering-wear-fields'
import { GutterColors } from '@/features/trade-scenes/ui/components/panel/gutter-colors'
import { GutterWearDots } from '@/features/trade-scenes/ui/components/panel/gutter-wear-dots'
import { PaintColors } from '@/features/trade-scenes/ui/components/panel/paint-colors'
import { PaintWearFields } from '@/features/trade-scenes/ui/components/panel/paint-wear-fields'
import { WearDots } from '@/features/trade-scenes/ui/components/panel/wear-dots'

interface MaterialInputGroupProps {
  id: MaterialInputGroupId
  // The material's own slot, or gutters' or air sealing's.
  slot: SceneChangeSlot
  slots: readonly SceneChangeSlot[]
  material: ResolvedHomeMaterial | null
}

// One group's input, with no heading or wrapper: whoever lays it out draws those.
export function MaterialInputGroup({ id, slot, slots, material }: MaterialInputGroupProps) {
  const applyChange = useApplySceneChange()
  const rated = ratedMaterial(material)
  switch (id) {
    case 'hvac-location':
    case 'hvac-components':
    case 'ac-tons':
    case 'mini-split-heads': {
      const riders = ridingSlot(slots, id)
      return riders && (
        <ChoicePill
          label={riders.name}
          value={riders.current ?? ''}
          options={riders.options.map(option => option.value)}
          labels={Object.fromEntries(riders.options.map(option => [option.value, option.label]))}
          onChange={value => applyChange(riders.change(value))}
        />
      )
    }
    case 'paint-colors':
      return <PaintColors side="existing" />
    case 'gutter-colors':
      return <GutterColors side="existing" />
    case 'condition': {
      const gutterWear = slot.id === 'gutters' ? ridingSlot(slots, 'gutter-wear') : null
      return (
        <>
          {rated && <WearDots material={rated} label={HOME_MATERIAL_LABELS[rated.id]} />}
          {gutterWear && <GutterWearDots slot={gutterWear} />}
        </>
      )
    }
    case 'wear':
      return (
        <>
          {rated?.id === 'exterior-paint' && <PaintWearFields />}
          {rated?.id === 'roof' && <CoveringWearFields />}
        </>
      )
  }
}
