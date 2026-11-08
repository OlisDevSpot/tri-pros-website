import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { HOUSE_CLOSING_SYSTEM_IDS, HOUSE_OPENING_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'

export function houseHeldOpen(cameraFocus: HomeSystemId | null): boolean {
  return cameraFocus !== null && (HOUSE_OPENING_SYSTEM_IDS as readonly HomeSystemId[]).includes(cameraFocus)
}

export function houseHeldClosed(cameraFocus: HomeSystemId | null): boolean {
  return cameraFocus !== null && (HOUSE_CLOSING_SYSTEM_IDS as readonly HomeSystemId[]).includes(cameraFocus)
}

// Derived, never written: the rep's own pick stays in the store, so leaving the system puts it back with nothing to remember.
export function houseOpen(state: Pick<TradeSceneInputs, 'homeView' | 'cameraFocus'>): boolean {
  return (state.homeView === 'partly-open' && !houseHeldClosed(state.cameraFocus)) || houseHeldOpen(state.cameraFocus)
}
