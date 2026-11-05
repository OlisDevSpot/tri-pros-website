import type { StoreApi } from 'zustand'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { flushSync } from 'react-dom'

import { LEAVE_LOOK_INSIDE } from '@/features/trade-scenes/constants/scene-controls'

// Focus a control held as it left the page, or that had already fallen to the page, is lost to the keyboard; focus
// anywhere else is where the rep put it.
export function focusFell(held: Element | null): boolean {
  return held === document.body || (held instanceof HTMLElement && !held.isConnected)
}

// Back to the system. Focus an up-close control held, or that had already fallen to the page, goes to the way back in:
// the card's Look inside, else the system's rail chip, else Systems; focus anywhere else on the stage stays put.
export function leaveLookInside(store: StoreApi<TradeSceneInputs>, stage: Element): void {
  const system = store.getState().cameraFocus
  const held = document.activeElement
  // eslint-disable-next-line react-dom/no-flush-sync -- the up-close controls leave only once this write renders
  flushSync(() => store.setState(LEAVE_LOOK_INSIDE))
  if (focusFell(held)) {
    const back = stage.querySelector<HTMLElement>('[data-look-inside]')
      ?? stage.querySelector<HTMLElement>(`[data-rail-chip="${system}"]`)
      ?? stage.querySelector<HTMLElement>('[data-section-button="systems"]')!
    back.focus()
  }
}
