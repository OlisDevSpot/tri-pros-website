import type { BoxSpec, HouseWall, WallOpening } from '@/features/trade-scenes/types'

import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'

const SEGMENT = { length: [0.16, 0.3], step: 3, width: 0.011, depth: 0.004 } as const
// Keeps a crack off the window and door edges, where it would read as a gap in the frame.
const OPENING_MARGIN = 0.25
const WALL_MARGIN = 0.4

interface CrackSpec {
  wall: HouseWall
  /** The wall's outside face, from its centre line. */
  face: number
  floorY: number
  top: number
  /** The count at the Worn look. */
  perWall: number
  seed: number
  /** A share of the Worn look's count. */
  share: number
  /** Start heights are drawn from this band, and a segment that leaves it stops. */
  band?: readonly [number, number]
  /** A ceiling that varies along the wall; a crack starting above it is dropped, a segment rising above it stops. */
  under?: (along: number) => number
  /** What the cracks keep off, for a wall whose own openings leave one out (the front wall's door). */
  openings?: readonly WallOpening[]
  /** How far the frame the wall is drawn in is stretched upward; each crack is laid out at its real size within it. */
  stretch?: number
}

// Hairline cracks wander across a wall's outside face in short straight runs. Each crack's draws follow only the cracks before
// it, so a higher share keeps every crack a lower one drew and adds more.
export function stuccoCracks({ wall, face, floorY, top, perWall, seed, share, band, under, openings = wall.openings, stretch = 1 }: CrackSpec): BoxSpec[] {
  const count = Math.round(perWall * share)
  const random = seededRandom(seed)
  const boxes: BoxSpec[] = []
  const clear = (along: number, height: number) => openings.every(opening => Math.abs(along - opening.along) > opening.width / 2 + OPENING_MARGIN
    || height < floorY + opening.sill - OPENING_MARGIN || height > floorY + opening.head + OPENING_MARGIN)
  for (let crack = 0; crack < count; crack++) {
    let along = wall.from + WALL_MARGIN + random() * (wall.to - wall.from - WALL_MARGIN * 2)
    let height = band ? band[0] + random() * (band[1] - band[0]) : floorY + 0.4 + random() * (top - floorY - 0.8)
    let heading = (random() - 0.5) * Math.PI * 0.9
    if (under && height > under(along)) {
      continue
    }
    for (let step = 0; step < SEGMENT.step; step++) {
      const length = SEGMENT.length[0] + random() * (SEGMENT.length[1] - SEGMENT.length[0])
      const run = Math.cos(heading) * length
      const rise = Math.sin(heading) * length / stretch
      const toAlong = along + run
      const toHeight = height + rise
      const outOfBand = band !== undefined && (toHeight < band[0] || toHeight > band[1])
      if (!clear(toAlong, toHeight) || outOfBand || (under && toHeight > under(toAlong)) || toAlong < wall.from + 0.1 || toAlong > wall.to - 0.1) {
        break
      }
      // In a stretched frame the box runs between the squashed ends, so the stretch carries it back to its real length and slope.
      // Unstretched it keeps the drawn numbers as they are: rebuilt through atan2 they round off, and every wall's cracks would move.
      const drawn = stretch === 1 ? { length, heading } : { length: Math.hypot(run, rise), heading: Math.atan2(rise, run) }
      const box = wallBox(wall, [-SEGMENT.width / 2, SEGMENT.width / 2], [-drawn.length / 2, drawn.length / 2], face + SEGMENT.depth / 2, SEGMENT.depth)
      const centre = [(along + toAlong) / 2, (height + toHeight) / 2] as const
      // The box was built unrotated around the origin of its own wall frame; move it to the segment's middle and tilt it.
      boxes.push(placed(wall, box, centre, drawn.heading - Math.PI / 2))
      along = toAlong
      height = toHeight
      heading += (random() - 0.5) * 1.2
    }
  }
  return boxes
}

function placed(wall: HouseWall, box: BoxSpec, centre: readonly [number, number], tilt: number): BoxSpec {
  const [width, height, depth] = box.size
  return wall.run === 'x'
    ? { size: [width, height, depth], position: [centre[0], centre[1], box.position[2]], rotation: [0, 0, tilt] }
    : { size: [width, height, depth], position: [box.position[0], centre[1], centre[0]], rotation: [-tilt, 0, 0] }
}
