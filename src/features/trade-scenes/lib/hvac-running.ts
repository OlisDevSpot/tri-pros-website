import type { HomeThermalZone } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { DrawnHvac, HvacDuties } from '@/features/trade-scenes/types'
import type { Weather } from '@/shared/modules/construction/core/types'

export type HvacRunningPart = 'blower' | 'furnace' | 'coil' | 'outdoor' | 'package' | 'wall-unit' | 'window-unit' | 'mini-split'

const NOTHING: ReadonlySet<HvacRunningPart> = new Set()

function covers({ cools, heats }: HvacDuties, weather: 'summer' | 'winter'): boolean {
  return weather === 'summer' ? cools : heats
}

// What runs on the side on show this weather. The indoor unit runs only the sections the season needs: the blower and
// coil with the condenser to cool, the blower and furnace to heat. Every other system runs whole in a season its duties
// cover, unless a new central system has left it idle. A normal day or a storm runs nothing.
export function hvacRunning(drawn: DrawnHvac, weather: Weather): ReadonlySet<HvacRunningPart> {
  if (weather !== 'summer' && weather !== 'winter') {
    return NOTHING
  }
  const running = new Set<HvacRunningPart>()
  const { indoor } = drawn
  if (indoor !== null && weather === 'summer' && indoor.coil !== null && drawn.outdoor !== null) {
    running.add('blower').add('coil').add('outdoor')
  }
  if (indoor !== null && weather === 'winter' && indoor.furnace !== null) {
    running.add('blower').add('furnace')
  }
  if (drawn.packageUnit !== null) {
    running.add('package')
  }
  if (covers(drawn.wallOrWindowDuties, weather)) {
    if (drawn.wallUnit !== null && !drawn.wallUnit.idle) {
      running.add('wall-unit')
    }
    if (drawn.windowUnit !== null && !drawn.windowUnit.idle) {
      running.add('window-unit')
    }
  }
  if (drawn.miniSplit !== null && !drawn.miniSplit.idle) {
    running.add('mini-split')
  }
  return running
}

// The thermal camera's reading for a component: the air it carries while it runs, else the air it stands in.
export function runningZone(runs: boolean, side: 'heating' | 'cooling' | null, still: HomeThermalZone): HomeThermalZone {
  return runs && side !== null ? side : still
}
