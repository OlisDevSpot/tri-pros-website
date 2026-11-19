'use client'

import type { HomeSystemId, TradeSceneInputs, YardId } from '@/features/trade-scenes/types'

import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { useLayoutEditorStore } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { startDrawing } from '@/features/trade-scenes/lib/create-layout-editor'
import { homeSpotContext } from '@/features/trade-scenes/lib/keep-look-inside'
import { systemActions } from '@/features/trade-scenes/lib/system-actions'
import { canLookInside } from '@/features/trade-scenes/lib/systems-at-spot'
import { SystemActionButton } from '@/features/trade-scenes/ui/components/controls/system-action-button'
import { useSceneCamera } from '@/shared/components/scene/contexts/scene-camera-context'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SystemActionsRowProps {
  subject: HomeSystemId | 'year-built' | YardId
}

export function SystemActionsRow({ subject }: SystemActionsRowProps) {
  const { focusCamera, toggleLookInside } = useSceneControls()
  const editor = useLayoutEditorStore()
  const moved = useSceneCamera(state => state.moved)
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const lookInside = useSceneInputs((state: TradeSceneInputs) => state.lookInside)
  const system = HOME_SYSTEM_IDS.find(id => id === subject) ?? null
  const offered = useSceneInputs((state: TradeSceneInputs) => system !== null && canLookInside(system, homeSpotContext(state)))
  const actions = systemActions(
    subject,
    { cameraFocus, moved, lookInside, canLookInside: offered },
    { focusCamera, toggleLookInside, draw: tool => tool === 'ground' ? startDrawing(editor!, 'ground') : startDrawing(editor!, 'fence') },
  )
  if (actions.length === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map(action => <SystemActionButton key={action.id} action={action} />)}
    </div>
  )
}
