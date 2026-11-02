import type { HomeAnchorId } from '@/features/trade-scenes/constants/home-anchors'

import { HOME_ANCHOR_IDS } from '@/features/trade-scenes/constants/home-anchors'

// Anchors share one pin registry with the assembly kits' part pins, so their ids carry a prefix no part id uses.
const PREFIX = 'anchor:'

export function anchorPinId(anchor: HomeAnchorId): string {
  return `${PREFIX}${anchor}`
}

export function anchorFromPinId(id: string): HomeAnchorId | null {
  if (!id.startsWith(PREFIX)) {
    return null
  }
  const anchor = id.slice(PREFIX.length)
  return HOME_ANCHOR_IDS.find(candidate => candidate === anchor) ?? null
}
