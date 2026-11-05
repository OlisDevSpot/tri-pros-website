'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useState } from 'react'

import { SHINGLE_COPY, SHINGLE_LINE_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { LA_MIN_AGED_SRI, OWENS_CORNING_SHINGLES } from '@/shared/modules/construction/core/constants/owens-corning-shingles'

type ShingleLine = (typeof OWENS_CORNING_SHINGLES)[number]['line']

const LINES: readonly ShingleLine[] = ['cool', 'cool-plus']

// The swatch fills are Owens Corning's own colours, the one place the panel paints a colour that is not a token.
export function ShingleColors() {
  const colorId = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.shingleColor)
  const applyChange = useApplySceneChange()
  const picked = OWENS_CORNING_SHINGLES.find(color => color.id === colorId) ?? null
  const [chosenLine, setChosenLine] = useState<ShingleLine>(picked?.line ?? 'cool')
  const line = picked?.line ?? chosenLine
  const colors = OWENS_CORNING_SHINGLES.filter(color => color.line === line)

  function changeLine(next: ShingleLine) {
    setChosenLine(next)
    if (picked && picked.line !== next) {
      applyChange({ kind: 'fact', patch: { shingleColor: null } })
    }
  }

  return (
    <div className="grid gap-2 px-1 pt-2">
      <ChoicePill label={SHINGLE_COPY.label} value={line} options={LINES} labels={SHINGLE_LINE_LABELS} onChange={changeLine} />
      {/* 12 apart, so each swatch's 40 px reach meets its neighbour's without taking a press meant for it. */}
      <div role="radiogroup" aria-label={SHINGLE_COPY.label} className="flex flex-wrap gap-3">
        {colors.map(color => (
          <Button
            key={color.id}
            type="button"
            variant="ghost"
            size="icon"
            role="radio"
            aria-checked={color.id === colorId}
            aria-label={color.name}
            title={color.name}
            onClick={() => applyChange({ kind: 'fact', patch: { shingleColor: color.id } })}
            style={{ backgroundColor: color.hex }}
            // The 28 px swatch reaches 40 past its edge.
            className={cn('relative size-7 rounded-md ring-1 ring-foreground/20 ring-inset after:absolute after:-inset-1.5', color.id === colorId && 'ring-2 ring-primary')}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-bold text-foreground">{picked?.name ?? SHINGLE_COPY.notPicked}</span>
        {picked && ` · ${picked.agedSri >= LA_MIN_AGED_SRI ? SHINGLE_COPY.sriMeetsLa(String(picked.agedSri)) : SHINGLE_COPY.sriMeetsTitle24(String(picked.agedSri))}`}
      </p>
    </div>
  )
}
