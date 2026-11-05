import type { ShakeCourse, ShingleCourse, TileCourse } from '@/features/trade-scenes/types'

// Exaggerated past true size: a real 5 in course would alias into a grey blur at house scale on an iPad.
export const SHINGLE = { exposure: 0.21, length: 0.34, tab: 0.46, gap: 0.014, thickness: 0.026 } as const satisfies ShingleCourse
export const TILE = { exposure: 0.33, length: 0.44, radius: 0.105 } as const satisfies TileCourse
export const SHAKE = { exposure: 0.25, length: 0.42, minWidth: 0.13, maxWidth: 0.3, gap: 0.012, thickness: 0.03 } as const satisfies ShakeCourse

// Rafters, joists and studs share one grid, the way a framer lays them out from one end.
export function framingGrid(from: number, to: number, spacing: number): number[] {
  const count = Math.floor((to - from) / spacing) + 1
  return Array.from({ length: count }, (_, index) => from + index * spacing)
}
