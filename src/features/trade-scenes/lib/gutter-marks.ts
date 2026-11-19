import type { StainBox, StainBoxes } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { FASCIA_CENTRE, HOUSE, RAFTER_ORIGIN_Y, ROOF_HALF_LENGTH, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { FRONT_STAIN_WALL } from '@/features/trade-scenes/lib/painted-surface-stains'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'

const { streaks: STREAKS, pulled: PULLED, overflow: OVERFLOW } = WEAR_LOOKS.gutter
const { fascia: FASCIA } = ROOF_TRIM
const STREAK_SEED = 23
// One list for every step, so a heavier step keeps every streak a lighter one drew and adds more.
const random = seededRandom(STREAK_SEED)
const STREAK_XS = Array.from({ length: STREAKS.count.failing }, () => -ROOF_HALF_LENGTH + random() * ROOF_HALF_LENGTH * 2)

// A stain lies a hair proud of the stucco's face, as the paint's own do, and the fascia's stands clear of a replaced board, which is
// set proud of the old one. A working number, set by shot.
const WALL_FACE = HOUSE.wallThickness / 2 + 0.002
const FASCIA_FACE = FASCIA.thickness / 2 + CUTAWAY_ROT.lift + 0.001
// The fascia's centre turned out of its slope's frame onto the front eave.
const [SIN, COS] = [Math.sin(HOUSE.pitch), Math.cos(HOUSE.pitch)]
const FASCIA_Y = RAFTER_ORIGIN_Y + FASCIA_CENTRE[0] * SIN + FASCIA_CENTRE[1] * COS
const FASCIA_Z = HOUSE.halfDepth - (FASCIA_CENTRE[0] * COS - FASCIA_CENTRE[1] * SIN)
const OVERFLOW_ALONG = [ROOF_HALF_LENGTH - PULLED.length / 2 - OVERFLOW.width / 2, ROOF_HALF_LENGTH - PULLED.length / 2 + OVERFLOW.width / 2] as const
const OVERFLOW_SEED = 41
const between = ([low, high]: readonly [number, number], at: number) => low + (high - low) * at
// Where the spill runs down: each run its own width and reach, scattered across the spill. Fixed, so the stain never moves.
const overflowRandom = seededRandom(OVERFLOW_SEED)
const OVERFLOW_RUNS = Array.from({ length: OVERFLOW.tracks }, () => {
  const width = between(OVERFLOW.trackWidth, overflowRandom())
  const from = OVERFLOW_ALONG[0] + overflowRandom() * (OVERFLOW.width - width)
  return { along: [from, from + width] as const, reach: between(OVERFLOW.reach, overflowRandom()) }
})

// The x of each streak down the front runs, more of them each step. The back run is never seen from the front, so it stays clean.
export function gutterStreaks(wear: Wear): readonly number[] {
  return STREAK_XS.slice(0, STREAKS.count[wear])
}

// A failing gutter's overflow on the fascia under its pulled end, down the board's whole height in each run.
export function gutterFasciaStains(wear: Wear): StainBoxes[] {
  if (wear !== 'failing') {
    return []
  }
  const boxes = OVERFLOW_RUNS.map(({ along: [from, to] }): StainBox => ({
    size: [to - from, FASCIA.height, 0],
    position: [(from + to) / 2, FASCIA_Y, FASCIA_Z + FASCIA_FACE],
  }))
  return [{ cell: 'streak', boxes, color: STREAKS.color, alpha: OVERFLOW.alpha }]
}

// The overflow's runs down the front wall under the pulled end, from the eave. The front wall draws only on the Complete house,
// so they are drawn with the wall's own stains rather than with the gutter. A run cut at the wall's end shows only its share of
// the shape rather than the whole squeezed in; one wholly past it is dropped.
export function gutterWallStains(wear: Wear): StainBoxes[] {
  if (wear !== 'failing') {
    return []
  }
  const boxes = OVERFLOW_RUNS.filter(({ along }) => along[0] < FRONT_STAIN_WALL.to).map(({ along, reach }): StainBox => {
    const [from, to] = [Math.max(along[0], FRONT_STAIN_WALL.from), Math.min(along[1], FRONT_STAIN_WALL.to)]
    const share = (at: number) => (at - along[0]) / (along[1] - along[0])
    const height = [WALL_TOP_Y - reach * (WALL_TOP_Y - HOUSE.floorY), WALL_TOP_Y] as const
    return { ...wallBox(FRONT_STAIN_WALL, [from, to], height, WALL_FACE, 0), u: [share(from), share(to)] }
  })
  return [{ cell: 'streak', boxes, color: STREAKS.color, alpha: OVERFLOW.alpha }]
}
