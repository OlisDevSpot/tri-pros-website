'use client'

import type { WeatherSky } from '@/features/trade-scenes/types'

import dynamic from 'next/dynamic'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useRef, useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { DEFAULT_LAYOUT } from '@/features/trade-scenes/constants/layout-fixtures'
import { PROPERTY_LAYOUT_LAB_COPY } from '@/features/trade-scenes/constants/property-layout-lab-copy'
import { LAYOUT_URL_MAX, propertyLayoutParser } from '@/features/trade-scenes/constants/property-layout-query-parsers'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { LayoutEditorProvider } from '@/features/trade-scenes/contexts/layout-editor-context'
import { LotSlotContext } from '@/features/trade-scenes/contexts/lot-slot-context'
import { ResolvedLayoutProvider } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { useStageSize } from '@/features/trade-scenes/hooks/use-stage-size'
import { createLayoutEditor, endDrawing } from '@/features/trade-scenes/lib/create-layout-editor'
import { encodePropertyLayout } from '@/features/trade-scenes/lib/layout-codec'
import { LayoutEditorPanel } from '@/features/trade-scenes/ui/components/layout-editor/layout-editor-panel'
import { TradeSceneView } from '@/features/trade-scenes/ui/views/trade-scene-view'
import { SceneInputsProvider } from '@/shared/components/scene/contexts/scene-inputs-context'
import { createSceneInputs } from '@/shared/components/scene/lib/create-scene-inputs'
import { cn } from '@/shared/lib/utils'

// Through next/dynamic, as the canvas is, so the blueprint paper paints before three.js parses.
const LayoutLot = dynamic(() => import('@/features/trade-scenes/ui/components/layout-kit/layout-lot').then(m => m.LayoutLot), {
  ssr: false,
  loading: () => null,
})

// At module scope, so the slot keeps its identity and the home kit does not re-render on every lab render.
const lotSlot = (ground: WeatherSky['ground']) => <LayoutLot ground={ground} />

export function PropertyLayoutLabView() {
  const [fromUrl, setUrlLayout] = useQueryState('layout', propertyLayoutParser)
  // Seeded once from the link; after that the store leads and the URL follows it.
  const [store] = useState(() => createSceneInputs({ ...HOME_SCENE_DEFAULTS, layout: fromUrl ?? DEFAULT_LAYOUT }))
  const [editor] = useState(() => createLayoutEditor())
  // The stage's own box: the panel is placed in it and reads its width, so it never covers the sidebar.
  const frame = useRef<HTMLDivElement>(null)
  const { width } = useStageSize(frame)
  const narrow = width > 0 && width < SCENE_LAYOUT.narrowBelowWidth
  const setUrl = useRef(setUrlLayout)
  useEffect(() => {
    setUrl.current = setUrlLayout
  }, [setUrlLayout])

  useEffect(() => store.subscribe((state, prev) => {
    if (state.layout === prev.layout) {
      return
    }
    if (encodePropertyLayout(state.layout).length <= LAYOUT_URL_MAX) {
      void setUrl.current(state.layout)
    }
  }), [store])

  // The lab's own listener: the shortcut registry's actions run in the working scene, which has no draw mode. D only ends
  // drawing: drawing starts from a yard card, with a thing to draw chosen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target !== null && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (typing || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'd') {
        return
      }
      endDrawing(editor)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  // nuqs re-renders the hook's owner on every layout write, and so does the resolved layout above it, so the scene is built
  // once per store and those renders stop here.
  const scene = useMemo(() => (
    <LotSlotContext value={lotSlot}>
      <TradeSceneView inputs={store} />
    </LotSlotContext>
  ), [store])

  return (
    <LayoutEditorProvider store={editor}>
      <ResolvedLayoutProvider store={store}>
        <div ref={frame} className="relative h-full">
          <div data-lab-badge className="dark absolute top-4 left-4 z-20 text-foreground">
            <span className={cn(CONTROLS_CLASSES.tag, 'border-warning bg-warning/15 text-warning')}>{PROPERTY_LAYOUT_LAB_COPY.badge}</span>
          </div>
          {/* The scene mounts its own inputs provider inside; the panel sits beside the scene, so it is given the same store here. */}
          <SceneInputsProvider store={store}>
            <LayoutEditorPanel narrow={narrow} />
          </SceneInputsProvider>
          {scene}
        </div>
      </ResolvedLayoutProvider>
    </LayoutEditorProvider>
  )
}
