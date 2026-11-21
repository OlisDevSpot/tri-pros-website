import type { SystemLit } from '@/features/trade-scenes/types'

// The fixtures through the ceiling (the light cans, the duct boots, the vent pipes) and the foam round them are where the
// ceiling leaks or is sealed, so up close on the attic they light with the ceiling they pierce. Null anywhere else, where
// they take the ghost with the house.
export function ceilingOpeningPart(lit: SystemLit | null): 'ceiling' | null {
  return lit?.system === 'attic' && lit.shown.has('ceiling') ? 'ceiling' : null
}
