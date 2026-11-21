import type { PropertyLayout } from '@/features/trade-scenes/types'
import { paintTiles } from '@/features/trade-scenes/lib/paint-tiles'

export function massMask(layout: PropertyLayout): Uint8Array {
  const { cols, rows } = layout.lot
  return layout.house.masses.reduce<Uint8Array>((mask, mass) => paintTiles(mask, cols, rows, mass, 1), new Uint8Array(cols * rows))
}
