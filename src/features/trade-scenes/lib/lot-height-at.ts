import { GROUND_ROWS } from '@/features/trade-scenes/constants/home-lot'
import { heightOnRows } from '@/features/trade-scenes/lib/height-on-rows'

export const lotHeightAt = (z: number) => heightOnRows(GROUND_ROWS, z)
