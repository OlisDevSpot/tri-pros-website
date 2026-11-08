import type { SystemPart, SystemPartId, Vec3 } from '@/features/trade-scenes/types'

import { LOOK_INSIDE_WINDOW, WINDOW_SPREAD } from '@/features/trade-scenes/constants/look-inside'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'

const WINDOW_PARTS: readonly SystemPart<SystemPartId>[] = SYSTEM_PARTS.filter(entry => (entry.systems as readonly string[]).includes('windows'))
const { wall } = LOOK_INSIDE_WINDOW

// How far the pull has moved each shown window part out along the wall's outward normal: the flashing stays against the wall
// and each listed part after it stands one step further out, so the screen ends furthest out and a window with fewer parts
// spreads less. The unlisted whole glass stays where the house draws it.
export function windowSpread(shown: ReadonlySet<SystemPartId>, pull: number): ReadonlyMap<SystemPartId, Vec3> {
  const share = Math.min(Math.max(pull, 0), 1)
  let index = 0
  return new Map(WINDOW_PARTS.filter(entry => shown.has(entry.id)).map((entry): [SystemPartId, Vec3] => {
    if (entry.listed === false) {
      return [entry.id, [0, 0, 0]]
    }
    const out = wall.outward * index++ * WINDOW_SPREAD.step * share
    return [entry.id, wall.run === 'z' ? [out, 0, 0] : [0, 0, out]]
  }))
}
