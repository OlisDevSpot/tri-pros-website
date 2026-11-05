'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { SceneVisibleAreaValue } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { SCENE_STAGE_CLASS } from '@/features/trade-scenes/constants/scene-stage'
import { useSceneLoad } from '@/features/trade-scenes/contexts/scene-load-context'
import { SceneVisibleAreaProvider } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { ShortcutSheetProvider } from '@/features/trade-scenes/contexts/shortcut-sheet-context'
import { useSystemCardBottom } from '@/features/trade-scenes/contexts/system-card-bottom-context'
import { useStageSize } from '@/features/trade-scenes/hooks/use-stage-size'
import { sceneVisibleAreaFor } from '@/features/trade-scenes/lib/scene-visible-area-for'
import { stageShapeOf } from '@/features/trade-scenes/lib/stage-shape-of'
import { SceneShortcuts } from '@/features/trade-scenes/ui/components/scene-shortcuts'
import { ShortcutKeysDialog } from '@/features/trade-scenes/ui/components/shortcut-keys-dialog'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SceneStageProps {
  // Handed the measure as well as given it through context: the stage's own children place themselves by it.
  children: (layout: SceneVisibleAreaValue) => ReactNode
}

// Measures itself rather than asking CSS, so the shape the card is laid out for and the area the camera frames come
// from the same numbers.
export function SceneStage({ children }: SceneStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const stage = useStageSize(ref)
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- the element exists only once mounted, and the portals need it before paint
    setStageElement(ref.current)
  }, [])
  const systemHeld = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus !== null)
  const { bottom: systemCardBottom } = useSystemCardBottom()
  // Only a system that holds the camera is framed clear of its card.
  const focusCardBottom = systemHeld ? systemCardBottom : null
  const shape = stageShapeOf(stage.width, stage.height)
  const [sheetOpen, setSheetOpen] = useState(false)
  const phase = useSceneLoad(state => state.phase)
  // Whatever had focus when the sheet opened (the dock's button, or body after a tap on the scene) gets it back.
  const sheetOpener = useRef<Element | null>(null)
  const openSheet = useCallback(() => {
    sheetOpener.current = document.activeElement
    setSheetOpen(true)
  }, [])
  const returnFocus = useCallback((event: Event) => {
    event.preventDefault()
    const opener = sheetOpener.current
    if (opener instanceof HTMLElement && opener.isConnected) {
      opener.focus()
    }
  }, [])
  const layout = useMemo<SceneVisibleAreaValue>(
    () => ({
      area: sceneVisibleAreaFor({ shape, width: stage.width, height: stage.height, focusCardBottom }),
      shape,
      stage: { width: stage.width, height: stage.height },
      canvasOverhang: Math.max(0, Math.round(stage.right - stage.width)),
      stageElement,
    }),
    [shape, focusCardBottom, stage, stageElement],
  )
  const { area, canvasOverhang } = layout
  const visibleNarrow = stage.width - area.left - area.right < SCENE_LAYOUT.calloutNarrowBelow
  const vars = {
    '--scene-visible-left': `${area.left}px`,
    '--scene-visible-right': `${area.right}px`,
    '--scene-visible-bottom': `${area.bottom}px`,
    '--scene-visible-top': `${area.top}px`,
    '--scene-canvas-overhang': `${canvasOverhang}px`,
  } as CSSProperties

  return (
    <div
      ref={ref}
      data-stage
      data-shape={stage.width > 0 ? shape : undefined}
      data-visible-narrow={visibleNarrow || undefined}
      data-load-phase={phase}
      inert={phase !== 'live'}
      aria-busy={phase !== 'live' || undefined}
      style={vars}
      className={phase === 'live' ? SCENE_STAGE_CLASS : `${SCENE_STAGE_CLASS} select-none`}
    >
      <SceneVisibleAreaProvider value={layout}>
        <ShortcutSheetProvider openSheet={openSheet}>{children(layout)}</ShortcutSheetProvider>
      </SceneVisibleAreaProvider>
      <SceneShortcuts stageRef={ref} openSheet={openSheet} />
      <ShortcutKeysDialog open={sheetOpen} onOpenChange={setSheetOpen} onCloseAutoFocus={returnFocus} />
    </div>
  )
}
