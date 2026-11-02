import type { ResidentSpec } from '@/features/trade-scenes/types'

import { RESIDENT_EYES, RESIDENT_HAIR, RESIDENT_OUTFITS, RESIDENT_SKIN } from '@/features/trade-scenes/constants/resident-looks'

// Colours by the pack's material names; each figure names its own, and a name the figure lacks is simply unused.
export function residentPalette(resident: ResidentSpec, index: number): Record<string, string> {
  const outfit = RESIDENT_OUTFITS[index % RESIDENT_OUTFITS.length]
  const skin = RESIDENT_SKIN[index % RESIDENT_SKIN.length]
  const hair = RESIDENT_HAIR[resident.age]
  return {
    Skin: skin,
    Hair: hair,
    HairBase: hair,
    Eyebrows: hair,
    Eyes: RESIDENT_EYES,
    Shirt: resident.figure === 'woman' ? outfit.accent : outfit.top,
    Jacket: outfit.top,
    LightJacket: outfit.top,
    Pants: outfit.bottom,
    Socks: outfit.shoes,
    Shoes: outfit.shoes,
  }
}
