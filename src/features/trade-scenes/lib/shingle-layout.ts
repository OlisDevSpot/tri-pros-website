import type { CourseArea, ShingleCourse } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { wornShare } from '@/features/trade-scenes/lib/part-state'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

// Tabs in staggered rows. With `tabJitter`, tab widths vary row to row the way laminated architectural shingles do; without it
// the rows are the even three-tab pattern, and the random sequence (so the drawn roof) is unchanged.
export function layoutShingles({ seed, wear, xFrom, xTo, zFrom, zTo, base }: CourseArea, course: ShingleCourse): PieceLayout[] {
  const random = seededRandom(seed)
  const jitter = course.tabJitter ?? 0
  const share = wornShare(wear)
  const pieces: PieceLayout[] = []
  let row = 0
  for (let start = xFrom; start < xTo - course.length / 2; start += course.exposure, row++) {
    const stagger = jitter > 0 ? random() * course.tab : row % 2 === 0 ? 0 : course.tab / 2
    for (let left = zFrom - stagger; left < zTo;) {
      const tab = jitter > 0 ? course.tab * (1 - jitter / 2 + random() * jitter) : course.tab
      const z0 = Math.max(left + course.gap / 2, zFrom)
      const z1 = Math.min(left + tab - course.gap / 2, zTo)
      left += tab
      if (z1 - z0 < 0.04) {
        continue
      }
      const roll = random()
      if (roll < 0.05 * share) {
        continue
      }
      pieces.push({
        x: start + course.length / 2,
        y: base + course.thickness / 2 + 0.01,
        z: (z0 + z1) / 2,
        width: z1 - z0,
        tilt: roll > 1 - 0.05 * share ? -0.3 : -0.06,
        shade: 0.9 - 0.2133 * wear + random() * (0.16 + 0.2933 * wear),
      })
    }
  }
  return pieces
}
