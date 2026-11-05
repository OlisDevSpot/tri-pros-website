import type { HeatLaneFlows, HomeHeat } from '@/features/trade-scenes/types'

export function heatLaneFlows(heat: HomeHeat): HeatLaneFlows {
  const { flows, bounce } = heat
  const source = flows.roofSource
  const pastCovering = source * (1 - bounce.covering)
  const pastBarrier = pastCovering * (1 - bounce.barrier) * flows.roofPasses[0]
  return {
    roof: [source, pastBarrier, pastBarrier * flows.roofPasses[1]],
    pastCovering,
    coveringBounce: source * bounce.covering,
    barrierBounce: pastCovering * bounce.barrier,
    wall: [flows.wall, flows.wall * (1 - bounce.wall) * flows.wallPasses],
    wallBounce: flows.wall * bounce.wall,
    window: [flows.window, flows.window * (1 - bounce.window) * flows.windowPasses],
    windowBounce: flows.window * bounce.window,
  }
}
