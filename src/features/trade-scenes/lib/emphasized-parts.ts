import type { SystemPartId } from '@/features/trade-scenes/types'

import { PAIRED_EMPHASIS } from '@/features/trade-scenes/constants/look-inside'

const PAIRS: Partial<Record<SystemPartId, readonly SystemPartId[]>> = PAIRED_EMPHASIS
const NONE: ReadonlySet<SystemPartId> = new Set()

// The parts an emphasis keeps whole: the picked part and any its story is told with.
export function emphasizedParts(emphasized: SystemPartId | null): ReadonlySet<SystemPartId> {
  return emphasized === null ? NONE : new Set([emphasized, ...(PAIRS[emphasized] ?? [])])
}
