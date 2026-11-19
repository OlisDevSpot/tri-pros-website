'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { HOME_MATERIALS_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { WearScale } from '@/features/trade-scenes/ui/components/panel/wear-scale'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { ROOF_WEAR_LIMITS } from '@/shared/modules/construction/core/constants/roof-wear-limits'
import { ageBandOf } from '@/shared/modules/construction/core/lib/age-band-of'
import { bandsOf } from '@/shared/modules/construction/core/lib/resolve-home-materials'
import { wearChoices } from '@/shared/modules/construction/core/lib/wear-choices'

interface WearDotsProps {
  material: ResolvedHomeMaterial
  // The material's name, which every dot's label starts with.
  label: string
}

// A home material's wear: each dot names the ages its step stands for.
export function WearDots({ material, label }: WearDotsProps) {
  const property = useSceneInputs((state: TradeSceneInputs) => state.property)
  const applyChange = useApplySceneChange()
  const bands = bandsOf(material.id, property)
  const choices = wearChoices(material.id, property)
  // A limited roof's level no longer follows its age, so its dots name no years.
  const limited = material.id === 'roof' && property.roofType !== null && ROOF_WEAR_LIMITS[property.roofType] !== undefined

  return (
    <WearScale
      value={material.wear}
      name={label}
      choices={choices}
      label={(wear) => {
        if (limited) {
          return HOME_MATERIALS_COPY.dotLabelNoAge(label, WEAR_LABELS[wear])
        }
        const [from, to] = ageBandOf(bands, wear)
        const years = to === null ? HOME_MATERIALS_COPY.yearsFrom(String(from)) : HOME_MATERIALS_COPY.years(String(from), String(to))
        return HOME_MATERIALS_COPY.dotLabel(label, WEAR_LABELS[wear], years)
      }}
      onPick={wear => applyChange({ kind: 'wear', id: material.id, wear })}
      disabled={material.absent}
      guessed={material.wearBasis !== 'recorded'}
    />
  )
}
