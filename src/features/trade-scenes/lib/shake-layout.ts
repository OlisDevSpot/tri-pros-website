import type { CourseArea, ShakeCourse } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { wornShare } from '@/features/trade-scenes/lib/part-state'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

// Split shakes vary in width course to course, and the worn ones curl and split. `splitShare` draws that share of the worn
// shakes as two halves with a crack between; without it the random sequence (so the drawn roof) is unchanged.
export function layoutShakes({ seed, wear, xFrom, xTo, zFrom, zTo, base }: CourseArea, course: ShakeCourse): PieceLayout[] {
  const random = seededRandom(seed)
  const share = wornShare(wear)
  const splitShare = (course.splitShare ?? 0) * share
  const splitGap = course.splitGap ?? 0
  const pieces: PieceLayout[] = []
  for (let start = xFrom; start < xTo - course.length / 2; start += course.exposure) {
    let left = zFrom - random() * course.maxWidth
    while (left < zTo) {
      const width = course.minWidth + random() * (course.maxWidth - course.minWidth)
      const z0 = Math.max(left + course.gap / 2, zFrom)
      const z1 = Math.min(left + width - course.gap / 2, zTo)
      left += width
      if (z1 - z0 < 0.04) {
        continue
      }
      const roll = random()
      const piece: PieceLayout = {
        x: start + course.length / 2 + (random() - 0.5) * 0.04,
        y: base + course.thickness / 2 + 0.012,
        z: (z0 + z1) / 2,
        width: z1 - z0,
        tilt: roll > 1 - 0.1 * share ? -0.24 : -0.08 - random() * 0.03,
        shade: 0.84 - 0.24 * wear + random() * (0.3 + 0.2667 * wear),
      }
      // Rolled on its own share of the range, below the curl's, so a split shake lies flat and the crack shows.
      if (roll < splitShare && piece.width > splitGap * 6) {
        const half = (piece.width - splitGap) / 2
        pieces.push({ ...piece, z: z0 + half / 2, width: half }, { ...piece, z: z1 - half / 2, width: half, shade: piece.shade * 0.92 })
        continue
      }
      pieces.push(piece)
    }
  }
  return pieces
}
