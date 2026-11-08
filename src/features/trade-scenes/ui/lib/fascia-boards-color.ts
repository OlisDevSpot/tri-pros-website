import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'

// New fascia boards take the build's paint, picked trim and all, or stand primed when the build has no paint job; with no
// replacement there are none. `trim` is the picked trim colour.
export function fasciaBoardsColor(fasciaReplaced: boolean, repainted: boolean, trim: string): string | null {
  if (!fasciaReplaced) {
    return null
  }
  return repainted ? trim : HOME_PALETTE.primer
}
