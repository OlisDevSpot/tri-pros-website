'use client'

import type { FenceKindId, LineRange, LotLayout, LotSide, TradeSceneInputs } from '@/features/trade-scenes/types'

import { FENCE_KINDS, FENCE_NONE } from '@/features/trade-scenes/constants/fence-kinds'
import { LOT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useResolvedLayout } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { applyFenceStroke, commitLayout } from '@/features/trade-scenes/lib/create-layout-editor'
import { fenceKindAt } from '@/features/trade-scenes/lib/fence-kind-at'
import { fenceLineCells } from '@/features/trade-scenes/lib/lot-fences'
import { perimeterKindsFor } from '@/features/trade-scenes/lib/perimeter-kinds'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

const SIDES = ['front', 'left', 'right', 'back'] as const satisfies readonly LotSide[]
// Radix Select reserves '' for no value.
const NONE = 'none'

function lotLineOf(lot: LotLayout, side: LotSide): LineRange {
  if (side === 'front' || side === 'back') {
    return { axis: 'across', line: side === 'front' ? 0 : lot.rows, from: 0, to: lot.cols }
  }
  return { axis: 'along', line: side === 'left' ? 0 : lot.cols, from: 0, to: lot.rows }
}

// '' shows the placeholder: a lot line whose cells differ has no one kind to show, and a kind the side's select does not
// offer (a front line of full-height block wall) would render a blank trigger.
function sideValue(lot: LotLayout, side: LotSide): FenceKindId | typeof NONE | '' {
  const range = lotLineOf(lot, side)
  const values = new Set(fenceLineCells(range, lot).map(i => lot.fence.existing[range.axis][i]))
  if (values.size !== 1) {
    return ''
  }
  const [value] = values
  const kind = fenceKindAt(value)
  if (!kind) {
    return NONE
  }
  return perimeterKindsFor(side).includes(kind) ? kind : ''
}

export function LotPerimeterFields() {
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const editor = useLayoutEditorApi()
  const { layout } = useResolvedLayout()
  const { lot } = layout

  const setSide = (side: LotSide, value: string) => {
    const kind = perimeterKindsFor(side).find(k => k === value)
    if (!kind && value !== NONE) {
      return
    }
    commitLayout(inputs, editor, applyFenceStroke(layout, lotLineOf(lot, side), { existing: kind ?? FENCE_NONE, proposed: null }))
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {SIDES.map(side => (
        <div key={side} className="grid gap-1">
          <span className="text-xs font-bold text-muted-foreground">{LOT_COPY.sides[side]}</span>
          <Select value={sideValue(lot, side)} onValueChange={value => setSide(side, value)}>
            <SelectTrigger size="sm" className="w-full" aria-label={LOT_COPY.sides[side]} data-lot-side={side}>
              <SelectValue placeholder={LOT_COPY.mixed} />
            </SelectTrigger>
            <SelectContent className="dark">
              {perimeterKindsFor(side).map(kind => <SelectItem key={kind} value={kind}>{FENCE_KINDS[kind].label}</SelectItem>)}
              <SelectItem value={NONE}>{LOT_COPY.noFence}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
