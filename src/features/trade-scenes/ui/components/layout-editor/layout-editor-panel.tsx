'use client'

import type { PropertyLayout, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useMemo, useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { LAYOUT_EDITOR_COPY } from '@/features/trade-scenes/constants/layout-editor-copy'
import { DEFAULT_LAYOUT } from '@/features/trade-scenes/constants/layout-fixtures'
import { PROPERTY_LAYOUT_LAB_COPY } from '@/features/trade-scenes/constants/property-layout-lab-copy'
import { LAYOUT_URL_MAX } from '@/features/trade-scenes/constants/property-layout-query-parsers'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useResolvedLayout } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { commitLayout, undoLayout } from '@/features/trade-scenes/lib/create-layout-editor'
import { encodePropertyLayout } from '@/features/trade-scenes/lib/layout-codec'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

// Docked above the Controls' bottom band, which stands this high on a narrow stage.
const NARROW_BOTTOM = SCENE_LAYOUT.controls.groupBottom.portrait + SCENE_LAYOUT.controls.groupHeight + 8

interface LayoutEditorPanelProps {
  // Read from the stage's box, not the viewport: an open sidebar narrows the stage on a wide screen.
  narrow: boolean
}

export function LayoutEditorPanel({ narrow }: LayoutEditorPanelProps) {
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const editor = useLayoutEditorApi()
  const { layout } = useResolvedLayout()
  const undoDepth = useLayoutEditor(state => state.undo.length)
  // Copied stays shown until the layout moves on, so the label never claims a link that is out of date.
  const [copiedLayout, setCopiedLayout] = useState<PropertyLayout | null>(null)
  const tooLong = useMemo(() => encodePropertyLayout(layout).length > LAYOUT_URL_MAX, [layout])
  const copy = LAYOUT_EDITOR_COPY.layout

  const reset = () => {
    editor.setState({ selected: null })
    commitLayout(inputs, editor, DEFAULT_LAYOUT)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopiedLayout(layout)
  }

  return (
    <Card
      aria-label={PROPERTY_LAYOUT_LAB_COPY.title}
      className={cn(
        // Scoped dark, as the stage is: the panel sits beside the stage rather than in it, on the same dark ground.
        'dark absolute z-20 gap-4 overflow-y-auto overscroll-contain px-4 py-4 text-foreground shadow-2xl',
        narrow ? 'inset-x-0 max-h-[45%] rounded-b-none' : 'top-16 left-4 max-h-[calc(100%-9rem)] w-80',
      )}
      style={narrow ? { bottom: NARROW_BOTTOM } : undefined}
    >
      <h2 className="text-base font-bold text-foreground">{PROPERTY_LAYOUT_LAB_COPY.title}</h2>
      <section className="grid gap-2">
        <h3 className={CONTROLS_CLASSES.capsLabel}>{copy.title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={undoDepth === 0} onClick={() => undoLayout(inputs, editor)}>{copy.undo}</Button>
          <Button variant="secondary" size="sm" onClick={reset}>{copy.reset}</Button>
          <Button variant="secondary" size="sm" disabled={tooLong} onClick={() => void copyLink()}>
            {copiedLayout === layout ? copy.copied : copy.copyLink}
          </Button>
        </div>
        {tooLong && <p className="text-xs text-muted-foreground">{copy.tooLong}</p>}
      </section>
    </Card>
  )
}
