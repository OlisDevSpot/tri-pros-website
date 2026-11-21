import type { Wear } from '@/shared/modules/construction/core/constants/enums'

interface OverflowCover {
  repainted: boolean
  newFascia: boolean
}

// The old gutter left these stains, so new gutters alone never clean them: only the paint or the boards the build puts over
// them do, as installed paint shows none of the old paint's wear.
export function overflowStains(existingWear: Wear | null, { repainted, newFascia }: OverflowCover): { wall: Wear | null, fascia: Wear | null } {
  return {
    wall: repainted ? null : existingWear,
    fascia: repainted || newFascia ? null : existingWear,
  }
}
