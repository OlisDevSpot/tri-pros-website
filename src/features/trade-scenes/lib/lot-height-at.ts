import { GROUND_ROWS } from '@/features/trade-scenes/constants/home-lot'

export function lotHeightAt(z: number): number {
  const last = GROUND_ROWS.length - 1
  if (z <= GROUND_ROWS[0][0]) {
    return GROUND_ROWS[0][1]
  }
  if (z >= GROUND_ROWS[last][0]) {
    return GROUND_ROWS[last][1]
  }
  const next = GROUND_ROWS.findIndex(([rowZ]) => rowZ > z)
  const [z0, y0] = GROUND_ROWS[next - 1]
  const [z1, y1] = GROUND_ROWS[next]
  return y0 + (y1 - y0) * (z - z0) / (z1 - z0)
}
