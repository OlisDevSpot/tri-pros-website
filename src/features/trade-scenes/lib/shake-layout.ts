import type { CourseArea, ShakeCourse } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

// Split shakes vary in width course to course. `splitShare` draws that share of the shakes as two halves with a crack between,
// scaled by the Split level; the Curling level scales how many curl. Every shake draws the same run of rolls whether or not it
// splits or curls, so one level never moves another kind's shakes.
export function layoutShakes({ seed, wear, xFrom, xTo, zFrom, zTo, base, shares }: CourseArea, course: ShakeCourse): PieceLayout[] {
  const random = seededRandom(seed)
  const splitShare = (course.splitShare ?? 0) * shares.split
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
      const splitRoll = random()
      const curlRoll = random()
      const xJitter = random()
      const tiltJitter = random()
      const shadeRoll = random()
      const piece: PieceLayout = {
        x: start + course.length / 2 + (xJitter - 0.5) * 0.04,
        y: base + course.thickness / 2 + 0.012,
        z: (z0 + z1) / 2,
        width: z1 - z0,
        tilt: curlRoll > 1 - 0.1 * shares.curling ? -0.24 : -0.08 - tiltJitter * 0.03,
        shade: 0.84 - 0.24 * wear + shadeRoll * (0.3 + 0.2667 * wear),
      }
      if (splitRoll < splitShare && piece.width > splitGap * 6) {
        const half = (piece.width - splitGap) / 2
        pieces.push({ ...piece, z: z0 + half / 2, width: half }, { ...piece, z: z1 - half / 2, width: half, shade: piece.shade * 0.92 })
        continue
      }
      pieces.push(piece)
    }
  }
  return pieces
}
