import type { HomeSpotId } from '@/features/trade-scenes/types'

import { HOME_SPOT_IDS } from '@/features/trade-scenes/constants/home-systems'

// The spot chip's anchor shares one pin registry with the part pins and the readings, so its id carries a prefix neither uses.
const PREFIX = 'spot:'

export function spotPinId(spot: HomeSpotId): string {
  return `${PREFIX}${spot}`
}

export function spotFromPinId(id: string): HomeSpotId | null {
  if (!id.startsWith(PREFIX)) {
    return null
  }
  const spot = id.slice(PREFIX.length)
  return HOME_SPOT_IDS.find(candidate => candidate === spot) ?? null
}
