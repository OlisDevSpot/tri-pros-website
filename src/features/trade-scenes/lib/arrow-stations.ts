import type { ArrowLane, ArrowStation } from '@/features/trade-scenes/types'

import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'

interface NumberSink { [index: number]: number }

function legLength(points: ArrowLane['points'], end: number): number {
  const from = points[end - 1]
  const to = points[end]
  return Math.sqrt((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2 + (to[2] - from[2]) ** 2)
}

// Writes into flat arrays from slot `first` on and allocates nothing, so the scene can call it every frame straight into
// its GPU buffers. Returns how many slots it wrote; a lane with no arrows or no length writes none.
export function writeArrowStations(lane: ArrowLane, seconds: number, centres: NumberSink, directions: NumberSink, fades: NumberSink, first: number): number {
  const { points, count, speed } = lane
  let length = 0
  for (let end = 1; end < points.length; end++) {
    length += legLength(points, end)
  }
  if (count <= 0 || length === 0) {
    return 0
  }
  const edge = HEAT_ARROW_LOOK.edgeFade * length
  for (let i = 0; i < count; i++) {
    // Half a spacing in, so at the clock's start (reduced motion holds it there) no arrow sits on a faded end.
    const s = ((((i + 0.5) * length / count + seconds * speed) % length) + length) % length
    // Zero-length legs carry no tangent, so an arrow only ever sits on a leg with length; rounding past the last leg's
    // end keeps it on that leg.
    let leg = 0
    let legStart = 0
    let start = 0
    for (let end = 1; end < points.length; end++) {
      const span = legLength(points, end)
      if (span > 0) {
        leg = end
        legStart = start
        if (s < start + span) {
          break
        }
      }
      start += span
    }
    const from = points[leg - 1]
    const to = points[leg]
    const span = legLength(points, leg)
    const along = Math.min(Math.max((s - legStart) / span, 0), 1)
    const slot = first + i
    for (let axis = 0; axis < 3; axis++) {
      const delta = to[axis] - from[axis]
      centres[slot * 3 + axis] = from[axis] + delta * along
      directions[slot * 3 + axis] = delta / span
    }
    fades[slot] = Math.min(1, s / edge, (length - s) / edge)
  }
  return count
}

export function arrowStations(lane: ArrowLane, seconds: number): ArrowStation[] {
  const centres: number[] = []
  const directions: number[] = []
  const fades: number[] = []
  const written = writeArrowStations(lane, seconds, centres, directions, fades, 0)
  return Array.from({ length: written }, (_, i) => ({
    position: [centres[i * 3], centres[i * 3 + 1], centres[i * 3 + 2]] as const,
    direction: [directions[i * 3], directions[i * 3 + 1], directions[i * 3 + 2]] as const,
    fade: fades[i],
  }))
}
