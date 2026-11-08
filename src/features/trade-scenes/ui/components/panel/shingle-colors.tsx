'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useState } from 'react'

import { SHINGLE_COPY, SHINGLE_LINE_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { ColorSwatches } from '@/features/trade-scenes/ui/components/panel/color-swatches'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { LA_MIN_AGED_SRI, OWENS_CORNING_SHINGLES } from '@/shared/modules/construction/core/constants/owens-corning-shingles'
import { STANDARD_SHINGLES } from '@/shared/modules/construction/core/constants/standard-shingles'

type ShingleLine = (typeof OWENS_CORNING_SHINGLES)[number]['line']

const LINES: readonly ShingleLine[] = ['cool', 'cool-plus']

// With the cool roof on the colours are the two Duration lines'; off, they are the three standard browns, which carry no
// line and no reflectance.
export function ShingleColors({ cool }: { cool: boolean }) {
  const colorId = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.shingleColor)
  const applyChange = useApplySceneChange()
  const picked = OWENS_CORNING_SHINGLES.find(color => color.id === colorId) ?? null
  const [chosenLine, setChosenLine] = useState<ShingleLine>(picked?.line ?? 'cool')
  const line = picked?.line ?? chosenLine
  const colors = cool ? OWENS_CORNING_SHINGLES.filter(color => color.line === line) : STANDARD_SHINGLES
  const standardPicked = STANDARD_SHINGLES.find(color => color.id === colorId) ?? null

  function changeLine(next: ShingleLine) {
    setChosenLine(next)
    if (picked && picked.line !== next) {
      applyChange({ kind: 'fact', patch: { shingleColor: null } })
    }
  }

  return (
    <div className="grid gap-2 px-1 pt-2">
      {cool && <ChoicePill label={SHINGLE_COPY.label} value={line} options={LINES} labels={SHINGLE_LINE_LABELS} onChange={changeLine} />}
      <ColorSwatches label={SHINGLE_COPY.colorLabel} colors={colors} value={colorId} onPick={id => applyChange({ kind: 'fact', patch: { shingleColor: id } })} />
      <p className="text-xs text-muted-foreground">
        <span className="font-bold text-foreground">{(cool ? picked : standardPicked)?.name ?? SHINGLE_COPY.notPicked}</span>
        {cool && picked && ` · ${picked.agedSri >= LA_MIN_AGED_SRI ? SHINGLE_COPY.sriMeetsLa(String(picked.agedSri)) : SHINGLE_COPY.sriMeetsTitle24(String(picked.agedSri))}`}
      </p>
    </div>
  )
}
