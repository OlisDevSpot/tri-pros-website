import type { SystemLit, SystemPartTagData } from '@/features/trade-scenes/types'

import { LOOK_INSIDE } from '@/features/trade-scenes/constants/look-inside'

// A piece only the Complete house draws takes the ghost even when its part is lit: the system shows on what is always
// there (the near slope's kept run, the back slope), never on what a home view cuts away. Two exceptions. The walls are
// the whole skin the paint coats, the front face, the near eave and the front skirt too, and nothing in their Look inside
// needs seeing past, so their pieces light wherever they stand. A piece marked over the front is the windows' framed
// window, lit with its system while the front wall it stands in fades.
export function systemPartOpacity(tag: SystemPartTagData, completeOnly: boolean, lit: SystemLit, ghost: number): number {
  const part = tag.scenePart
  if (part === undefined || !lit.shown.has(part) || (completeOnly && tag.overFront !== true && lit.system !== 'walls')) {
    return ghost
  }
  return lit.emphasized !== null && lit.emphasized !== part ? LOOK_INSIDE.dimmedOpacity : 1
}
