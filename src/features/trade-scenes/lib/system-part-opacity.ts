import type { SystemLit, SystemPartTagData } from '@/features/trade-scenes/types'

import { LOOK_INSIDE } from '@/features/trade-scenes/constants/look-inside'

// A piece only the Complete house draws takes the ghost even when its part is lit: the system shows on what is always
// there (the near slope's kept run, the back slope), never on what a home view cuts away.
export function systemPartOpacity(tag: SystemPartTagData, completeOnly: boolean, lit: SystemLit, ghost: number): number {
  const part = tag.scenePart
  if (part === undefined || completeOnly || !lit.shown.has(part)) {
    return ghost
  }
  return lit.emphasized !== null && lit.emphasized !== part ? LOOK_INSIDE.dimmedOpacity : 1
}
