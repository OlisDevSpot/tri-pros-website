import type { RoofType, Wear } from '@/shared/modules/construction/core/constants/enums'

// No wood shake roof has gone on in decades, so none is newer than Worn, and an unrated one is more likely failing than worn.
export const ROOF_WEAR_LIMITS: Partial<Record<RoofType, { choices: readonly Wear[], guess: Wear }>> = {
  woodshake: { choices: ['worn', 'failing'], guess: 'failing' },
}
