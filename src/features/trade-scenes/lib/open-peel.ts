import type { HomeSystemId } from '@/features/trade-scenes/types'

import { FULLY_OPEN_SYSTEMS } from '@/features/trade-scenes/constants/look-inside'

// How far a system up close stands open. One that stands fully open has no slider to set the store's peel, so every reader
// of the peel takes it through here and draws it fully stepped.
export function openPeel(system: HomeSystemId, peel: number): number {
  return FULLY_OPEN_SYSTEMS.has(system) ? 1 : peel
}
