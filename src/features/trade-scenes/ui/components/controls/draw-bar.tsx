'use client'

import type { LotOption } from '@/features/trade-scenes/lib/lot-options'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { CheckIcon, Undo2Icon } from 'lucide-react'
import { flushSync } from 'react-dom'

import { DRAW_ERASE } from '@/features/trade-scenes/constants/draw-pick'
import { PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { LOT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { LAYOUT_EDITOR_COPY } from '@/features/trade-scenes/constants/layout-editor-copy'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { endDrawing, startDrawing, undoLayout } from '@/features/trade-scenes/lib/create-layout-editor'
import { drawOffer, drawPickFor } from '@/features/trade-scenes/lib/draw-brush'
import { fenceLabel, fenceOptions, groundLabel, groundOptions } from '@/features/trade-scenes/lib/lot-options'
import { LotPickChip } from '@/features/trade-scenes/ui/components/controls/lot-pick-chip'
import { focusFell } from '@/features/trade-scenes/ui/lib/leave-look-inside'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'

// Below this stage width the hint gives its room to the pick, Undo and Done.
const HINT_FROM_WIDTH = 480

// The eraser closes the list, so part of a thing can still be cut away.
function withEraser<T extends string>(offered: readonly LotOption<T>[], eraser: string): readonly LotOption<T | typeof DRAW_ERASE>[] {
  return [...offered, { value: DRAW_ERASE, label: eraser }]
}

// What is being drawn and the way out, across the top of the stage while the lot is drawn on. What it offers and the
// layer a stroke writes follow the view the scene shows. Mounted only where the lot is data.
export function DrawBar() {
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const editor = useLayoutEditorApi()
  const tool = useLayoutEditor(state => state.tool)
  const pick = useLayoutEditor(state => state.pick)
  const undoDepth = useLayoutEditor(state => state.undo.length)
  const view = useSceneInputs((state: TradeSceneInputs) => state.view)
  const { shape, stage, stageElement } = useSceneVisibleArea()
  const copy = LAYOUT_EDITOR_COPY.draw
  const proposed = view === 'proposed'
  const eraser = proposed ? LOT_COPY.keep : tool === 'ground' ? copy.backToBase : copy.noFence
  const grounds = drawOffer('ground', view)
  const fences = drawOffer('fence', view)
  const top = shape === 'portrait' ? SCENE_LAYOUT.controls.modalTop.portrait : SCENE_LAYOUT.controls.modalTop.wide

  // The bar leaves with drawing, so its focus goes to the card's button that starts this tool again.
  const done = () => {
    const held = document.activeElement
    // eslint-disable-next-line react-dom/no-flush-sync -- the yard card is back only once this write renders
    flushSync(() => endDrawing(editor))
    if (focusFell(held)) {
      stageElement?.querySelector<HTMLElement>(`[data-yard-draw="${tool}"]`)?.focus()
    }
  }

  const chip = tool === 'ground'
    ? (
        <LotPickChip
          id="draw"
          label={copy.drawing}
          options={withEraser(groundOptions(grounds), eraser)}
          value={drawPickFor(pick.ground, grounds)}
          labelOf={id => id === DRAW_ERASE ? eraser : groundLabel(id)}
          proposed={proposed}
          onPick={(next) => {
            if (next !== PROPOSED_KEEP) {
              startDrawing(editor, 'ground', next)
            }
          }}
        />
      )
    : (
        <LotPickChip
          id="draw"
          label={copy.drawing}
          options={withEraser(fenceOptions(fences), eraser)}
          value={drawPickFor(pick.fence, fences)}
          labelOf={id => id === DRAW_ERASE ? eraser : fenceLabel(id)}
          proposed={proposed}
          onPick={(next) => {
            if (next !== PROPOSED_KEEP) {
              startDrawing(editor, 'fence', next)
            }
          }}
        />
      )

  return (
    <div
      data-draw-bar={tool}
      role="group"
      aria-label={copy.drawing}
      style={{ top }}
      className="absolute left-1/2 z-30 flex w-max max-w-[calc(100%-1.25rem)] -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card py-1.25 pr-1.25 pl-3.5 shadow-lg"
    >
      <span className="text-sm font-bold whitespace-nowrap">{copy.drawing}</span>
      {chip}
      {stage.width >= HINT_FROM_WIDTH && (
        <span className="truncate text-xs text-muted-foreground">{tool === 'ground' ? copy.hintGround : copy.hintFence}</span>
      )}
      <Button type="button" variant="ghost" disabled={undoDepth === 0} onClick={() => undoLayout(inputs, editor)} className="h-11 shrink-0 rounded-full px-3">
        <Undo2Icon aria-hidden />
        {LAYOUT_EDITOR_COPY.layout.undo}
      </Button>
      <Button type="button" onClick={done} className="h-11 shrink-0 rounded-full px-4">
        <CheckIcon aria-hidden />
        {copy.done}
      </Button>
    </div>
  )
}
