import type { HomeSystemId, SystemActionId, YardId } from '@/features/trade-scenes/types'

import { LOT_COPY, SYSTEM_ACTION_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'

// `pressed: null` is an action that is not a toggle.
export interface SystemAction {
  id: SystemActionId
  label: string
  pressed: boolean | null
  run: () => void
}

interface SystemActionState {
  cameraFocus: HomeSystemId | null
  moved: boolean
  lookInside: boolean
  canLookInside: boolean
}

interface SystemActionRun {
  focusCamera: () => void
  toggleLookInside: () => void
  draw: (tool: 'ground' | 'fence') => void
}

// A hand move leaves the framing behind, so Focus reads as pressed only while the camera still sits where it put it.
export function systemActions(subject: HomeSystemId | 'year-built' | YardId, state: SystemActionState, run: SystemActionRun): SystemAction[] {
  if (subject === 'year-built') {
    return []
  }
  const system = HOME_SYSTEM_IDS.find(id => id === subject) ?? null
  if (system === null) {
    return [
      { id: 'draw-region', label: LOT_COPY.drawRegion, pressed: null, run: () => run.draw('ground') },
      { id: 'draw-fence', label: LOT_COPY.drawFence, pressed: null, run: () => run.draw('fence') },
    ]
  }
  return [
    { id: 'focus', label: SYSTEM_ACTION_COPY.focus, pressed: state.cameraFocus === system && !state.moved, run: run.focusCamera },
    ...state.canLookInside ? [{ id: 'look-inside' as const, label: SYSTEM_ACTION_COPY.lookInside, pressed: state.lookInside, run: run.toggleLookInside }] : [],
  ]
}
