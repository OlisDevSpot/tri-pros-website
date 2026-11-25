import type { FenceKindId } from '@/features/trade-scenes/types'
import { FENCE_KIND_IDS } from '@/features/trade-scenes/constants/fence-kinds'

export function fenceKindAt(value: number): FenceKindId | null {
  return FENCE_KIND_IDS[value - 1] ?? null
}
