import type { GroundLayer, LotLayout } from '@/features/trade-scenes/types'

// A proposed 0 keeps what is there, so the proposed layer shows the existing ground wherever nothing is proposed.
export function pickLayer(lot: LotLayout, layer: GroundLayer, i: number): number {
  return layer === 'proposed' && lot.proposed[i] !== 0 ? lot.proposed[i] : lot.existing[i]
}
