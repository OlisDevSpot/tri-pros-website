import type { CourseArea, TileCourse } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { wornShare } from '@/features/trade-scenes/lib/part-state'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

// Pans and caps alternate this far apart, so each cap laps the seam between two pans.
const COLUMN_PER_RADIUS = 1.15

// Barrel tile in two courses: pans open upward, caps lap the seams between them.
export function layoutTiles({ seed, wear, xFrom, xTo, zFrom, zTo, base }: CourseArea, course: TileCourse): { pans: PieceLayout[], caps: PieceLayout[] } {
  const random = seededRandom(seed)
  const pans: PieceLayout[] = []
  const caps: PieceLayout[] = []
  const column = course.radius * COLUMN_PER_RADIUS
  const share = wornShare(wear)
  for (let start = xFrom; start < xTo - course.length / 2; start += course.exposure) {
    let index = 0
    for (let z = zFrom + course.radius; z <= zTo - course.radius; z += column, index++) {
      const roll = random()
      if (roll < 0.04 * share) {
        continue
      }
      const isCap = index % 2 === 1
      const piece: PieceLayout = {
        x: start + course.length / 2,
        y: base + (isCap ? course.radius * 0.55 : course.radius * 1.02),
        z,
        width: course.length,
        tilt: roll > 1 - 0.04 * share ? -0.16 : -0.05,
        shade: 0.88 - 0.2133 * wear + random() * (0.18 + 0.2133 * wear),
      }
      ;(isCap ? caps : pans).push(piece)
    }
  }
  return { pans, caps }
}
