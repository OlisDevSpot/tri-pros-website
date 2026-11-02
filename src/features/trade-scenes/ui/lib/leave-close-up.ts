import type { StoreApi } from 'zustand'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { flushSync } from 'react-dom'

import { ASSEMBLY_KITS } from '@/features/trade-scenes/constants/assembly-kits'
import { LEAVE_CLOSE_UP } from '@/features/trade-scenes/constants/scene-controls'

// Focus a control held as it left the page, or that had already fallen to the page, is lost to the keyboard; focus
// anywhere else is where the rep put it.
export function focusFell(held: Element | null): boolean {
  return held === document.body || (held instanceof HTMLElement && !held.isConnected)
}

// Back to the whole home. Focus a close-up control held, or that had already fallen to the page, goes to the pin that
// opened the close-up once the home has drawn its pins back, else to Systems, the group's way into the same parts; focus
// anywhere else on the stage stays put.
export function leaveCloseUp(store: StoreApi<TradeSceneInputs>, stage: Element): void {
  const anchor = ASSEMBLY_KITS[store.getState().zoom!]?.anchor
  const held = document.activeElement
  // eslint-disable-next-line react-dom/no-flush-sync -- the close-up's controls leave only once this write renders
  flushSync(() => store.setState(LEAVE_CLOSE_UP))
  if (focusFell(held)) {
    const pin = anchor ? stage.querySelector<HTMLElement>(`[data-anchor-pin="${anchor}"]`) : null
    ;(pin ?? stage.querySelector<HTMLElement>('[data-section-button="systems"]')!).focus()
  }
}
