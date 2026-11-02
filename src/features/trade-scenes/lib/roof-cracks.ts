import type { BoxSpec } from '@/features/trade-scenes/types'

import { FRONT_WALL, HOUSE, HOUSE_WALLS, PARAPET_TOP, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'
import { stuccoCracks } from '@/features/trade-scenes/lib/stucco-cracks'

const FACE = HOUSE.wallThickness / 2
// Working numbers, tuned by eye: the band the gable cracks start in, and how far under the rake they stay.
const GABLE_BAND = [WALL_TOP_Y + 0.1, WALL_TOP_Y + 0.55] as const
const RAKE_CLEARANCE = 0.08
// Working numbers, tuned by eye: the parapet face is short, so the cracks stay clear of the floor line and the coping.
const PARAPET_BAND = [WALL_TOP_Y + 0.08, PARAPET_TOP - 0.08] as const
const GABLE_COUNT = 12
const PARAPET_COUNT = 3

const LEFT_FRONT_HALF = { ...HOUSE_WALLS.left, from: 0 }
const LEFT_BACK_HALF = { ...HOUSE_WALLS.left, to: 0 }

// Cracks on the end-wall gables, kept under the rake: a gable is a pentagon, narrower than the wall below it.
export function gableCracks(share: number): { left: BoxSpec[], right: BoxSpec[] } {
  const crack = (wall: typeof HOUSE_WALLS.left | typeof HOUSE_WALLS.right, seed: number) => stuccoCracks({
    wall,
    face: FACE,
    floorY: HOUSE.floorY,
    top: WALL_TOP_Y,
    perWall: GABLE_COUNT,
    seed,
    share,
    band: GABLE_BAND,
    under: z => roofUndersideY(z, 'pitched') - RAKE_CLEARANCE,
  })
  return { left: crack(HOUSE_WALLS.left, 41), right: crack(HOUSE_WALLS.right, 42) }
}

// The left parapet's front half lifts away with the Complete house, so its cracks are a list of their own.
export function parapetCracks(share: number): { kept: BoxSpec[], complete: BoxSpec[] } {
  const crack = (wall: Parameters<typeof stuccoCracks>[0]['wall'], seed: number) => stuccoCracks({
    wall,
    face: FACE,
    floorY: HOUSE.floorY,
    top: WALL_TOP_Y,
    perWall: PARAPET_COUNT,
    seed,
    share,
    band: PARAPET_BAND,
  })
  return {
    kept: [...crack(HOUSE_WALLS.back, 51), ...crack(HOUSE_WALLS.right, 52), ...crack(LEFT_BACK_HALF, 53)],
    complete: [...crack(LEFT_FRONT_HALF, 54), ...crack(FRONT_WALL, 55)],
  }
}
