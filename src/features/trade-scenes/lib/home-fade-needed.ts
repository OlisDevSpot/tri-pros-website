import type { HomeFadeLevels } from '@/features/trade-scenes/types'

import { HOME_FADES } from '@/features/trade-scenes/constants/home-fades'

// Not only while an ease runs: a settled fade still has to reach a part that mounts later or a material swapped in.
export function homeFadeNeeded(ghost: number, levels: HomeFadeLevels): boolean {
  if (ghost < 1) {
    return true
  }
  for (const fade of HOME_FADES) {
    if (levels[fade] < 1) {
      return true
    }
  }
  return false
}
