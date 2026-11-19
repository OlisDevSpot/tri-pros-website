'use client'

import { useEffect } from 'react'

import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneTapAway } from '@/features/trade-scenes/hooks/use-scene-tap-away'
import { endDrawing } from '@/features/trade-scenes/lib/create-layout-editor'
import { DrawBar } from '@/features/trade-scenes/ui/components/controls/draw-bar'
import { SystemActionCard } from '@/features/trade-scenes/ui/components/controls/system-action-card'

// The yard Areas holds on the Lot group, and its card, or the draw bar while the lot is drawn on. Leaving the group or
// Areas by any door ends drawing and lets the yard and anything selected in it go, so the camera is handed back and the
// outline never outlives the card. Mounted only where the lot is data.
export function LotAreasSection() {
  const { group, close } = useSceneControls()
  const editor = useLayoutEditorApi()
  const yard = useLayoutEditor(state => state.yard)
  const drawing = useLayoutEditor(state => state.mode === 'draw')
  const onLot = group === 'lot'
  // Areas' tap-away, here where the editor can be read: a tap that ends on the lot while drawing is a stroke too short
  // to paint, never a tap away.
  useSceneTapAway(!drawing, close)

  useEffect(() => {
    if (!onLot) {
      return
    }
    return () => {
      endDrawing(editor)
      editor.setState({ yard: null, selected: null })
    }
  }, [onLot, editor])

  if (!onLot) {
    return null
  }
  if (drawing) {
    return <DrawBar />
  }
  return yard !== null ? <SystemActionCard key={yard} subject={yard} /> : null
}
