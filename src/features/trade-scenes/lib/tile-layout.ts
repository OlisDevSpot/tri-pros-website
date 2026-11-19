import type { CourseArea, CoveringPiece, TileCourse } from '@/features/trade-scenes/types'

import { TILE_WEAR } from '@/features/trade-scenes/constants/covering-wear'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

// Pans and caps alternate this far apart, so each cap laps the seam between two pans.
const COLUMN_PER_RADIUS = 1.15

// Barrel tile in two courses: pans open upward, caps lap the seams between them. Every tile draws the same run of rolls whatever
// the levels, and a cracked or broken tile keeps whatever misalignment it has, so one level never moves another kind's tiles and a
// reused roof matches the old one tile for tile.
export function layoutTiles({ seed, wear, xFrom, xTo, zFrom, zTo, base, shares, reused }: CourseArea, course: TileCourse): { pans: CoveringPiece[], caps: CoveringPiece[] } {
  const random = seededRandom(seed)
  const pans: CoveringPiece[] = []
  const caps: CoveringPiece[] = []
  const column = course.radius * COLUMN_PER_RADIUS
  const { jitter, slipped } = TILE_WEAR
  const signed = () => random() * 2 - 1
  for (let start = xFrom; start < xTo - course.length / 2; start += course.exposure) {
    let index = 0
    for (let z = zFrom + course.radius; z <= zTo - course.radius; z += column, index++) {
      const place = random()
      const slipRoll = random()
      const [jitterX, jitterZ, jitterYaw, jitterTilt] = [signed(), signed(), signed(), signed()]
      const [slipX, slipZ, slipYaw] = [random(), signed(), signed()]
      const crackValue = 1 - random()
      const brokenValue = 1 - random()
      const shadeRoll = random()

      const cracked = place < TILE_WEAR.crackedRate * shares.cracked
      const broken = place > 1 - TILE_WEAR.brokenRate * shares.broken
      const isCap = index % 2 === 1
      const piece: CoveringPiece = {
        x: start + course.length / 2,
        y: base + (isCap ? course.radius * 0.55 : course.radius * 1.02),
        z,
        width: course.length,
        tilt: -0.05,
        shade: 0.88 - 0.2133 * wear + shadeRoll * (0.18 + 0.2133 * wear),
      }
      if (reused) {
        piece.replacement = cracked || broken ? true : undefined
      }
      else {
        if (slipRoll < TILE_WEAR.slippedRate * shares.misaligned) {
          piece.x -= slipped.x[0] + slipX * (slipped.x[1] - slipped.x[0])
          piece.z += slipZ * slipped.z
          piece.yaw = slipYaw * slipped.yaw
          piece.tilt = slipped.tilt
        }
        else {
          piece.x += jitterX * jitter.x * shares.misaligned
          piece.z += jitterZ * jitter.z * shares.misaligned
          piece.yaw = jitterYaw * jitter.yaw * shares.misaligned
          piece.tilt += jitterTilt * jitter.tilt * shares.misaligned
        }
        if (cracked) {
          piece.crack = crackValue
        }
        else if (broken) {
          piece.broken = brokenValue
        }
      }
      ;(isCap ? caps : pans).push(piece)
    }
  }
  return { pans, caps }
}
