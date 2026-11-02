import type { SlopePoint } from '@/features/trade-scenes/types'

// The centre of the fascia in a slope's own frame. It hangs plumb against the rafter tails' plumb cut, outside them and the
// deck's edge, with its inner top corner `top` above the slope's base.
export function eaveFasciaCentre(eaveRun: number, pitch: number, fascia: { height: number, thickness: number }, top: number): SlopePoint {
  const sin = Math.sin(pitch)
  const cos = Math.cos(pitch)
  const rise = top / cos
  return [
    -eaveRun + (rise - fascia.height / 2) * sin - (fascia.thickness / 2) * cos,
    (rise - fascia.height / 2) * cos + (fascia.thickness / 2) * sin,
  ]
}
