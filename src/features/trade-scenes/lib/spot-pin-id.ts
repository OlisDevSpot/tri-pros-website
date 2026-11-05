import type { HomeSystemId } from '@/features/trade-scenes/types'

import { LOOK_INSIDE_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'

// Spot pins share one pin registry with the part pins and the readings, so their ids carry a prefix neither uses.
const PREFIX = 'spot:'

export function spotPinId(system: HomeSystemId): string {
  return `${PREFIX}${system}`
}

// Only a system a spot opens can have a pin there.
export function spotFromPinId(id: string): (typeof LOOK_INSIDE_SYSTEM_IDS)[number] | null {
  if (!id.startsWith(PREFIX)) {
    return null
  }
  const system = id.slice(PREFIX.length)
  return LOOK_INSIDE_SYSTEM_IDS.find(candidate => candidate === system) ?? null
}
