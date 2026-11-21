import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { HOUSE_CLOSING_SYSTEM_IDS, HOUSE_OPENING_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'

// The system the house is held for: the one whose card is open, else the one a tapped spot's chip is editing.
export function heldSystem(state: Pick<TradeSceneInputs, 'pickedSystem' | 'tappedSpot'>): HomeSystemId | null {
  return state.pickedSystem ?? state.tappedSpot?.editing ?? null
}

export function houseHeldOpen(system: HomeSystemId | null): boolean {
  return system !== null && (HOUSE_OPENING_SYSTEM_IDS as readonly HomeSystemId[]).includes(system)
}

export function houseHeldClosed(system: HomeSystemId | null): boolean {
  return system !== null && (HOUSE_CLOSING_SYSTEM_IDS as readonly HomeSystemId[]).includes(system)
}

// Derived, never written: the rep's own pick stays in the store, so leaving the system puts it back with nothing to remember.
export function houseOpen(state: Pick<TradeSceneInputs, 'homeView' | 'pickedSystem' | 'tappedSpot'>): boolean {
  const system = heldSystem(state)
  return (state.homeView === 'partly-open' && !houseHeldClosed(system)) || houseHeldOpen(system)
}
