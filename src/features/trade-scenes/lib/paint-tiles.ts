import type { TileRect } from '@/features/trade-scenes/types'

// Same instance back when nothing changes, so a no-op stroke never re-renders.
export function paintTiles(map: Uint8Array, cols: number, rows: number, rect: TileRect, value: number, mask?: Uint8Array): Uint8Array {
  const c1 = Math.min(cols, rect.c0 + rect.cols)
  const r1 = Math.min(rows, rect.r0 + rect.rows)
  let next: Uint8Array | null = null
  for (let r = Math.max(0, rect.r0); r < r1; r++) {
    for (let c = Math.max(0, rect.c0); c < c1; c++) {
      const i = r * cols + c
      if (mask?.[i] === 1 || map[i] === value) {
        continue
      }
      next ??= map.slice()
      next[i] = value
    }
  }
  return next ?? map
}

export function paintList(map: Uint8Array, indices: readonly number[], value: number, mask?: Uint8Array): Uint8Array {
  let next: Uint8Array | null = null
  for (const i of indices) {
    if (i < 0 || i >= map.length || mask?.[i] === 1 || map[i] === value) {
      continue
    }
    next ??= map.slice()
    next[i] = value
  }
  return next ?? map
}

export function rectBetween(a: readonly [number, number], b: readonly [number, number]): TileRect {
  const c0 = Math.min(a[0], b[0])
  const r0 = Math.min(a[1], b[1])
  return { c0, r0, cols: Math.abs(a[0] - b[0]) + 1, rows: Math.abs(a[1] - b[1]) + 1 }
}
