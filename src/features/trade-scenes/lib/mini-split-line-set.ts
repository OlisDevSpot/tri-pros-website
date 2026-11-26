import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'

import { HOME_FLOOR_Y, HOUSE, MINI_SPLIT_HEAD_SIZE, MINI_SPLIT_HEADS, MINI_SPLIT_LINE_SIZE, MINI_SPLIT_OUTDOOR, MINI_SPLIT_RUNS } from '@/features/trade-scenes/constants/home-geometry'

const LEFT_FACE = -HOUSE.halfLength - MINI_SPLIT_LINE_SIZE / 2
const BACK_FACE = -HOUSE.halfDepth - MINI_SPLIT_LINE_SIZE / 2
const UNIT_BACK = MINI_SPLIT_OUTDOOR.position[0] + MINI_SPLIT_OUTDOOR.size[0] / 2

// One run to each of the first `heads` heads, in the house's frame, so the runs ride with the walls they are fixed to. The
// outdoor unit stands on the lawn whatever the floor, so the leg out of it sits lower in that frame as the floor rises.
export function miniSplitLineSet(heads: number, floorY: number = HOME_FLOOR_Y.slab): Vec3[][] {
  const portY = MINI_SPLIT_RUNS.port - (floorY - HOUSE.floorY)
  return MINI_SPLIT_HEADS.slice(0, heads).map((head, index) => {
    const { riser, y } = MINI_SPLIT_RUNS.runs[index]
    const [x, , z] = head.position
    return [
      [UNIT_BACK, portY, riser],
      [LEFT_FACE, portY, riser],
      [LEFT_FACE, y, riser],
      [LEFT_FACE, y, BACK_FACE],
      [x, y, BACK_FACE],
      [x, y, z - head.outward * MINI_SPLIT_HEAD_SIZE[2] / 2],
    ]
  })
}

// Each straight leg of each run as a box `size` square, carried half that past its ends so the legs meet at the corners.
export function lineSetBoxes(runs: readonly (readonly Vec3[])[], size: number): BoxSpec[] {
  return runs.flatMap(run => run.slice(1).map((to, index): BoxSpec => {
    const from = run[index]
    const extent = (axis: 0 | 1 | 2) => Math.abs(to[axis] - from[axis]) + size
    return {
      size: [extent(0), extent(1), extent(2)],
      position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    }
  }))
}
