import type { ControlsSection, SystemsFocus, TradeSceneInputs } from '@/features/trade-scenes/types'

interface ControlsPressState {
  open: ControlsSection | null
  focus: SystemsFocus
  view: TradeSceneInputs['view']
}

interface ControlsPressResult extends ControlsPressState {
  // Set when the press changed the side shown without the toggle, so the change is said out loud.
  toast: boolean
}

// Any section press lets the system go: opening another section leaves Systems, and pressing Systems again closes it.
export function pressSection(state: ControlsPressState, section: ControlsSection): ControlsPressResult {
  if (state.open === section) {
    return { open: null, focus: null, view: state.view, toast: false }
  }
  // Benefits shows only the build.
  const flips = section === 'benefits' && state.view === 'existing'
  return { open: section, focus: null, view: flips ? 'proposed' : state.view, toast: flips }
}

export function flipView(state: ControlsPressState): ControlsPressResult {
  const view = state.view === 'existing' ? 'proposed' : 'existing'
  const open = view === 'existing' && state.open === 'benefits' ? null : state.open
  return { open, focus: state.focus, view, toast: false }
}

export function pressFocus(state: ControlsPressState, focus: SystemsFocus): ControlsPressResult {
  return { open: state.open, focus: state.focus === focus ? null : focus, view: state.view, toast: false }
}
