import type { SystemLit, SystemPartId } from '@/features/trade-scenes/types'

// The fixtures through the ceiling (the light cans, the duct boots, the vent pipes) are what the attic's air gaps are round,
// so up close on the attic they light with the part that tells that story: the air sealing once it seals them, the ceiling
// they pierce while the gaps are open. Null anywhere else, where they take the ghost with the house.
export function ceilingOpeningPart(lit: SystemLit | null): SystemPartId | null {
  if (lit === null || lit.system !== 'attic') {
    return null
  }
  return lit.shown.has('air-sealing') ? 'air-sealing' : lit.shown.has('ceiling') ? 'ceiling' : null
}
