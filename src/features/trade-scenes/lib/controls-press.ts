import type { ControlsSection, HomeSystemId, SystemsPick, TradeSceneInputs } from '@/features/trade-scenes/types'

interface ControlsPressState {
  open: ControlsSection | null
  picked: SystemsPick
  view: TradeSceneInputs['view']
}

interface ControlsPressResult extends ControlsPressState {
  // Set when the press changed the side shown without the toggle, so the change is said out loud.
  toast: boolean
}

// Any section press lets the system go: opening another section leaves Systems, and pressing Systems again closes it.
export function pressSection(state: ControlsPressState, section: ControlsSection): ControlsPressResult {
  if (state.open === section) {
    return { open: null, picked: null, view: state.view, toast: false }
  }
  // Benefits shows only the build.
  const flips = section === 'benefits' && state.view === 'existing'
  return { open: section, picked: null, view: flips ? 'proposed' : state.view, toast: flips }
}

export function flipView(state: ControlsPressState): ControlsPressResult {
  const view = state.view === 'existing' ? 'proposed' : 'existing'
  const open = view === 'existing' && state.open === 'benefits' ? null : state.open
  return { open, picked: state.picked, view, toast: false }
}

export function pressPick(state: ControlsPressState, pick: SystemsPick): ControlsPressResult {
  return { open: state.open, picked: state.picked === pick ? null : pick, view: state.view, toast: false }
}

// A spot chip's system button does what the system's rail chip does: Systems opens with that system picked, whatever was open, and never steps
// inside it.
export function pressChip(state: ControlsPressState, system: HomeSystemId): ControlsPressResult {
  return { open: 'systems', picked: system, view: state.view, toast: false }
}

// The spot chip belongs to the house as it was tapped, so turning it lets the chip go.
export function pressHomeView(homeView: TradeSceneInputs['homeView']): Pick<TradeSceneInputs, 'homeView' | 'tappedSpot'> {
  return { homeView: homeView === 'complete' ? 'partly-open' : 'complete', tappedSpot: null }
}
