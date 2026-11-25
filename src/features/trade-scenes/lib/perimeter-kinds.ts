import type { FenceKindId, GroundLayer, LotSide } from '@/features/trade-scenes/types'
import { FENCE_KINDS, FENCE_KINDS_BY_LAYER } from '@/features/trade-scenes/constants/fence-kinds'

const STANDING = {
  existing: FENCE_KINDS_BY_LAYER.existing.filter(id => !FENCE_KINDS[id].gate),
  proposed: FENCE_KINDS_BY_LAYER.proposed.filter(id => !FENCE_KINDS[id].gate),
} as const satisfies Record<GroundLayer, readonly FenceKindId[]>

// The front yard caps a fence at 42 in, so a full-height block wall is never on offer there; the low wall is.
const FRONT = {
  existing: STANDING.existing.filter(id => id !== 'blockWall'),
  proposed: STANDING.proposed.filter(id => id !== 'blockWall'),
} as const satisfies Record<GroundLayer, readonly FenceKindId[]>

export function perimeterKindsFor(side: LotSide, layer: GroundLayer = 'existing'): readonly FenceKindId[] {
  return side === 'front' ? FRONT[layer] : STANDING[layer]
}
