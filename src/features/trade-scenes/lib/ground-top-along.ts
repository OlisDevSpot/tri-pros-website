import { GROUND_ROWS } from '@/features/trade-scenes/constants/home-lot'
import { LOT_BOXES } from '@/features/trade-scenes/lib/lot-boxes'
import { lotHeightAt } from '@/features/trade-scenes/lib/lot-height-at'

// The highest ground under a straight run along z at x: the lawn, or a bed's mulch where one covers it. The lawn is straight
// between its rows, so its highest point is at an end or a row.
export function groundTopAlong(x: number, from: number, to: number): number {
  const [near, far] = [Math.min(from, to), Math.max(from, to)]
  const lawn = [near, far, ...GROUND_ROWS.map(([z]) => z).filter(z => z > near && z < far)].map(lotHeightAt)
  const beds = LOT_BOXES.mulch.filter(({ size, position }) =>
    Math.abs(x - position[0]) <= size[0] / 2 && position[2] - size[2] / 2 <= far && position[2] + size[2] / 2 >= near)
  return Math.max(...lawn, ...beds.map(({ size, position }) => position[1] + size[1] / 2))
}
