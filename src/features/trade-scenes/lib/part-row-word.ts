import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { PART_COPY } from '@/features/trade-scenes/constants/home-scene-copy'

// What the work does to a part, in place of its condition where that would mislead: a part taken out reads as such, never New.
export function partRowWord(part: Pick<ResolvedPart, 'condition' | 'added' | 'removed'>): string {
  if (part.removed) {
    return PART_COPY.removed
  }
  return part.added ? PART_COPY.added : PART_COPY.condition[part.condition]
}
