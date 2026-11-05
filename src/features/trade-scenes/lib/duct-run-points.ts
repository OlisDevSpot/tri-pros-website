import type { DuctLayout, Vec3 } from '@/features/trade-scenes/types'

import { HUNG_DUCTS, LOW_SLOPE_DUCTS } from '@/features/trade-scenes/constants/home-details'
import { DEEPEST_INSULATION, EQUIPMENT, HOUSE, REGISTER_BOOT_TOP, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'

// A working number: a hung run's points stand at most this far apart. Pulled taut between its straps, a hung run is straight
// from bend to bend; through its corners alone the curve would bow off the straight line its straps hang on.
const HUNG_STEP = 0.3
// A hung run's level leg stops this many of its radii short of the point over its boot, so the drop bends through more than
// the tube's own girth; stopped right over the boot, a fat run folds on itself at the elbow. A working number, tuned by eye.
const DROP_BACK = 1.5

function taut(run: readonly Vec3[], y: number): Vec3[] {
  return run.flatMap(([x, , z], index): Vec3[] => {
    if (index === 0) {
      return [[x, y, z]]
    }
    const [fromX, , fromZ] = run[index - 1]
    const steps = Math.ceil(Math.hypot(x - fromX, z - fromZ) / HUNG_STEP)
    return Array.from({ length: steps }, (_, step): Vec3 => {
      const share = (step + 1) / steps
      return [fromX + (x - fromX) * share, y, fromZ + (z - fromZ) * share]
    })
  })
}

// Each run's points from the plenum to its boot. A run in a flat roof's joist space sags between its ends by `sag`,
// deepest midway. One lying on the joists rests there from its middle on into its boot, whose top it reaches, and rises by
// `sag` to the plenum: raised at the boot end too, its open end would stand out over the boot. A hung run is held level on
// its straps and sweeps down into its boot, since a straight drop folds the tube.
export function ductRunPoints(layout: DuctLayout, radius: number, sag: number): Vec3[][] {
  return EQUIPMENT.ductRuns.map((run) => {
    const dip = (index: number) => sag * Math.sin(Math.PI * index / (run.length - 1))
    if (layout === 'low-slope') {
      return run.map(([x, y, z], index): Vec3 => [x, y - LOW_SLOPE_DUCTS.drop - dip(index), z])
    }
    if (layout === 'floor') {
      const rest = WALL_TOP_Y + HOUSE.joistDepth + radius
      return run.map(([x, , z], index): Vec3 => [x, rest + (index > run.length / 2 ? 0 : sag - dip(index)), z])
    }
    const level = WALL_TOP_Y + DEEPEST_INSULATION + radius + HUNG_DUCTS.clear
    const [endX, , endZ] = run[run.length - 1]
    const [fromX, , fromZ] = run[run.length - 2]
    const back = (radius * DROP_BACK) / Math.hypot(endX - fromX, endZ - fromZ)
    const legEnd: Vec3 = [endX + (fromX - endX) * back, level, endZ + (fromZ - endZ) * back]
    return [...taut([...run.slice(0, -1), legEnd], level), [endX, REGISTER_BOOT_TOP, endZ]]
  })
}
