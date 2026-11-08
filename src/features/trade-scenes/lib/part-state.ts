import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'

export interface PartState {
  material: string | null
  /** 0 is new, 0.75 is the Worn look and 1 is Failing. */
  wear: number
}

const ABSENT: PartState = { material: null, wear: 0 }

/** Where a wear sits between New and the Worn look; past 1 for Failing. */
export function wornShare(wear: number): number {
  return wear / WEAR_AMOUNT.worn
}

// The home draws each part from the resolved parts, never the profile, so what it draws is what the card lists and the
// savings count.
export function partState(parts: readonly ResolvedPart[], id: string): PartState {
  const part = parts.find(entry => entry.id === id)
  if (!part) {
    return ABSENT
  }
  const kept = part.condition === 'retained' || part.condition === 'worn'
  return { material: part.material, wear: kept ? WEAR_AMOUNT[part.wear ?? 'worn'] : 0 }
}

/** A number that runs from its fresh value to its Worn value as the wear does. */
export function wornValue(fresh: number, worn: number, wear: number): number {
  return fresh + (worn - fresh) * wornShare(wear)
}
