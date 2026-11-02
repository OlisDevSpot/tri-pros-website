import type { ArrowLane, CeilingOpening, HomeHeat, HomeView, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { Season } from '@/shared/modules/construction/core/types'

import { WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import {
  ATTIC_FAN_LANE,
  CEILING_LEAK_LANE,
  COVERING_STANDOFF,
  DEFAULT_COVERING_STANDOFF,
  HOME_COMPLETE_ROOF_HEAT_LANES,
  HOME_COMPLETE_WALL_HEAT_LANES,
  HOME_COMPLETE_WINDOW_HEAT_LANES,
  HOME_ROOF_HEAT_LANES,
  HOME_WALL_HEAT_LANES,
  HOME_WINDOW_HEAT_LANES,
} from '@/features/trade-scenes/constants/home-heat-lanes'
import { bounceArrowLane, heatArrowLane } from '@/features/trade-scenes/lib/heat-arrow-lane'
import { heatLaneFlows } from '@/features/trade-scenes/lib/heat-lane-flows'

export function coveringStandoff(covering: string | null): number {
  return (covering === null ? undefined : COVERING_STANDOFF[covering]) ?? DEFAULT_COVERING_STANDOFF
}

// Every lane the whole home draws for this heat. Summer heat comes in from the sky and the sun-struck walls and windows;
// winter heat leaves the rooms the same way out, and with no sun there is nothing to bounce. The Complete house shows only
// the outside legs, up to the faces they strike; the covering decides how far off the roof they stop. `leaks` is the ceiling
// openings air sealing has not closed.
export function homeHeatLanes(form: RoofForm, heat: HomeHeat, season: Season, homeView: HomeView, covering: string | null, leaks: readonly CeilingOpening[]): ArrowLane[] {
  const flows = heatLaneFlows(heat)
  const summer = season === 'summer'
  // A face's flows run from the heat's source: the sun on it and then what gets in in summer, the rooms' heat at it and then
  // what escapes in winter. The outer leg is the yard's side either way.
  const outer = summer ? 0 : 1
  const inner = summer ? 1 : 0
  const faces = [
    { flows: flows.wall, bounce: flows.wallBounce, complete: HOME_COMPLETE_WALL_HEAT_LANES, open: HOME_WALL_HEAT_LANES },
    { flows: flows.window, bounce: flows.windowBounce, complete: HOME_COMPLETE_WINDOW_HEAT_LANES, open: HOME_WINDOW_HEAT_LANES },
  ]
  const lanes: ArrowLane[] = []
  const run = (from: Vec3, to: Vec3, flow: number) => lanes.push(heatArrowLane(summer ? [from, to] : [to, from], flow))
  const bounce = (from: Vec3, to: Vec3, flow: number) => {
    const lane = summer ? bounceArrowLane([from, to], flow) : null
    if (lane !== null) {
      lanes.push(lane)
    }
  }
  // Never through `run`: a fan only ever blows out, whatever the season.
  if (heat.atticFanRunning) {
    lanes.push(heatArrowLane([ATTIC_FAN_LANE.vent, ATTIC_FAN_LANE.outside], flows.roof[1]))
  }

  if (homeView === 'complete') {
    const standoff = coveringStandoff(covering)
    for (const lane of HOME_COMPLETE_ROOF_HEAT_LANES[form]) {
      const struck: Vec3 = [lane.covering[0], lane.covering[1] + standoff, lane.covering[2]]
      // The outer leg carries the sky's flow in summer and the last of the rooms' in winter.
      run(lane.sky, struck, flows.roof[summer ? 0 : 2])
      bounce(struck, lane.coveringBounceTo, flows.coveringBounce)
    }
    for (const face of faces) {
      for (const lane of face.complete) {
        run(lane.outside, lane.face, face.flows[outer])
        bounce(lane.face, lane.bounceTo, face.bounce)
      }
    }
    return lanes.filter(lane => lane.count > 0)
  }

  for (const lane of HOME_ROOF_HEAT_LANES[form]) {
    const outsideIn = [lane.sky, lane.covering, lane.atticFloor, lane.room] as const
    // The flows run in order from wherever the heat comes from, so winter's first flow is the room's.
    for (let leg = 0; leg < 3; leg++) {
      const from = summer ? leg : 2 - leg
      run(outsideIn[from], outsideIn[from + 1], flows.roof[leg])
    }
    bounce(lane.covering, lane.coveringBounceTo, flows.coveringBounce)
    bounce(lane.barrier, lane.barrierBounceTo, flows.barrierBounce)
  }
  for (const face of faces) {
    for (const lane of face.open) {
      run(lane.outside, lane.face, face.flows[outer])
      run(lane.face, lane.inside, face.flows[inner])
      bounce(lane.face, lane.bounceTo, face.bounce)
    }
  }
  // The gaps are in the ceiling, under the blanket, so they leak whatever the insulation; a flat roof has no attic over them.
  if (form === 'pitched') {
    for (const { at: [x, z] } of leaks) {
      run([x, WALL_TOP_Y + CEILING_LEAK_LANE.above, z], [x, WALL_TOP_Y - CEILING_LEAK_LANE.below, z], CEILING_LEAK_LANE.flow)
    }
  }
  return lanes.filter(lane => lane.count > 0)
}
