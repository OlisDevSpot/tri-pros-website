import type { CeilingOpening } from '@/features/trade-scenes/types'

import { CEILING_OPENINGS } from '@/features/trade-scenes/constants/home-geometry'

const WITHOUT_BOOTS = CEILING_OPENINGS.filter(opening => opening.kind !== 'boot')

// A home with no ducts in the attic has no register boots coming through its ceiling.
export function ceilingOpenings(ducted: boolean): readonly CeilingOpening[] {
  return ducted ? CEILING_OPENINGS : WITHOUT_BOOTS
}
