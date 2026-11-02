import type { SlopePoint } from '@/features/trade-scenes/types'

// A rafter's side, its top edge carrying the deck from the eave to the ridge. Both ends are cut plumb: one cut square to
// the slope would carry its lower corner past the ridge and out past the fascia.
export function rafterProfile(eaveRun: number, slopeLength: number, depth: number, pitch: number): readonly SlopePoint[] {
  const plumb = depth * Math.tan(pitch)
  return [[-eaveRun, 0], [slopeLength, 0], [slopeLength - plumb, -depth], [-eaveRun - plumb, -depth]]
}
