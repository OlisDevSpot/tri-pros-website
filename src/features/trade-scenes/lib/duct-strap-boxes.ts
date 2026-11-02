import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'

import { HUNG_DUCTS } from '@/features/trade-scenes/constants/home-details'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'

// The straps a hung run hangs from, spaced along its level points (all but the drop into the boot) and starting half a
// spacing out, since the plenum carries the run's start. Each runs from the duct's top up to the roof's underside.
export function ductStrapBoxes(runs: readonly (readonly Vec3[])[], radius: number): BoxSpec[] {
  return runs.flatMap((run) => {
    const level = run.slice(0, -1)
    const straps: BoxSpec[] = []
    let next = HUNG_DUCTS.strapSpacing / 2
    let walked = 0
    for (let index = 1; index < level.length; index++) {
      const [fromX, y, fromZ] = level[index - 1]
      const [toX, , toZ] = level[index]
      const length = Math.hypot(toX - fromX, toZ - fromZ)
      while (next <= walked + length) {
        const share = (next - walked) / length
        const x = fromX + (toX - fromX) * share
        const z = fromZ + (toZ - fromZ) * share
        const bottom = y + radius
        const top = roofUndersideY(z, 'pitched')
        straps.push({ size: [HUNG_DUCTS.strap, top - bottom, HUNG_DUCTS.strap], position: [x, (bottom + top) / 2, z] })
        next += HUNG_DUCTS.strapSpacing
      }
      walked += length
    }
    return straps
  })
}
