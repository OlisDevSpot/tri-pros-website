import type { ArrowLane, Vec3 } from '@/features/trade-scenes/types'

import { HEAT_ARROW_SCALE, HEAT_FLOW_STOPPED } from '@/features/trade-scenes/constants/home-heat-figures'

// Count and speed read the table's flow directly, never the lane's shape, so a lane can be sized before it has points.
export function heatArrowLane(points: readonly Vec3[], flow: number): ArrowLane {
  const { arrowsAtFull, speedAtFull, speedAtLeast } = HEAT_ARROW_SCALE
  const count = flow < HEAT_FLOW_STOPPED ? 0 : Math.max(1, Math.round(flow * arrowsAtFull))
  const share = Math.min(Math.max(flow, 0), 1)
  const speed = speedAtLeast + (speedAtFull - speedAtLeast) * share
  return { points, count, speed, flow: share }
}

// Heat turned back is drawn only where it is worth a whole arrow: unlike a lane heat crosses, a trickle of bounce gets no
// arrow of its own, so a mild day's cool roof never draws more arrows than the roof it replaced. A whole arrow, not one
// rounded up from a half: inland Normal's cool roof turns back half an arrow's worth.
export function bounceArrowLane(points: readonly Vec3[], flow: number): ArrowLane | null {
  if (flow <= HEAT_FLOW_STOPPED || flow * HEAT_ARROW_SCALE.arrowsAtFull < 1) {
    return null
  }
  return heatArrowLane(points, flow)
}
