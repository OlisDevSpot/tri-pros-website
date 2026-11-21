'use client'

import type { SceneChangeSlot, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { HOME_MATERIALS_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { WearScale } from '@/features/trade-scenes/ui/components/panel/wear-scale'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { ageBandOf } from '@/shared/modules/construction/core/lib/age-band-of'
import { bandsOf } from '@/shared/modules/construction/core/lib/resolve-home-materials'

// The gutters' condition. Its ages are the roof's, since the gutters are rated against the same era; the ring is dashed while
// the rep has not rated them and the roof's condition stands in.
export function GutterWearDots({ slot }: { slot: SceneChangeSlot }) {
  const property = useSceneInputs((state: TradeSceneInputs) => state.property)
  const rated = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.gutterWear !== null)
  const applyChange = useApplySceneChange()
  const bands = bandsOf('roof', property)

  return (
    <WearScale
      value={slot.current as Wear | null}
      name={HOME_MATERIALS_COPY.gutters}
      label={(wear) => {
        const [from, to] = ageBandOf(bands, wear)
        const years = to === null ? HOME_MATERIALS_COPY.yearsFrom(String(from)) : HOME_MATERIALS_COPY.years(String(from), String(to))
        return HOME_MATERIALS_COPY.dotLabel(HOME_MATERIALS_COPY.gutters, WEAR_LABELS[wear], years)
      }}
      onPick={wear => applyChange(slot.change(wear))}
      guessed={!rated}
    />
  )
}
