import type { BoxSpec, HouseWall, WallOpening } from '@/features/trade-scenes/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'
import { sillLedgeBox } from '@/features/trade-scenes/lib/window-boxes'

// A stain is a flat box a hair proud of the stucco's face, so it needs no plane of its own and no turn to face out.
const FACE = HOUSE.wallThickness / 2 + 0.002
// Working numbers, tuned by eye: a streak stops short of the floor line, keeps clear of a wall's ends, and is dropped if an
// opening below the eave leaves it shorter than this.
const STREAK_FLOOR_CLEAR = 0.05
const STREAK_END_MARGIN = 0.3
const STREAK_SHORTEST = 0.1
// One or two hang under each sill.
const STREAKS_PER_SILL = 2

const { paint: LOOK } = WEAR_LOOKS
const between = ([low, high]: readonly [number, number], at: number) => low + (high - low) * at

function stain(wall: HouseWall, along: readonly [number, number], height: readonly [number, number]): BoxSpec {
  return wallBox(wall, along, height, FACE, 0)
}

function overlaps(openings: readonly WallOpening[], floorY: number, along: readonly [number, number], height: readonly [number, number]): boolean {
  return openings.some(opening => along[1] > opening.along - opening.width / 2 && along[0] < opening.along + opening.width / 2
    && height[1] > floorY + opening.sill && height[0] < floorY + opening.head)
}

// The muddy band rain splashes up the foot of a wall, one layer per step of the level along the whole run. Each layer passes
// under an opening it reaches at the opening's sill, so a door splits it and a crawl vent lowers it. The openings are measured
// from the floor, which never sits below the band's foot, so measuring them from the foot keeps the band under every sill.
// `stretch` is how far the frame the wall is drawn in is stretched upward; the band is laid out at its real height within it.
export function splashBand(wall: HouseWall, base: number, share: number, openings: readonly WallOpening[] = wall.openings, stretch = 1): BoxSpec[] {
  const layers = LOOK.splashLayers.slice(0, Math.round(LOOK.splashCount * share))
  const inside = openings
    .filter(opening => opening.along - opening.width / 2 >= wall.from && opening.along + opening.width / 2 <= wall.to)
    .sort((a, b) => a.along - b.along)
  return layers.flatMap((layer) => {
    const top = base + layer / stretch
    const boxes: BoxSpec[] = []
    let cursor = wall.from
    for (const opening of inside) {
      const sill = base + opening.sill
      if (sill >= top) {
        continue
      }
      const [left, right] = [opening.along - opening.width / 2, opening.along + opening.width / 2]
      if (left > cursor) {
        boxes.push(stain(wall, [cursor, left], [base, top]))
      }
      if (sill > base) {
        boxes.push(stain(wall, [left, right], [base, sill]))
      }
      cursor = right
    }
    if (cursor < wall.to) {
      boxes.push(stain(wall, [cursor, wall.to], [base, top]))
    }
    return boxes
  })
}

// Runoff streaks: one or two hang from under each window's sill ledge, and fainter single ones from the eave line. Every
// streak's draws follow only the streaks before it, so a higher share keeps every streak a lower one drew and adds more. The
// first rounds give each sill a streak and the eave one, so a light level still marks every window.
export function runoffStreaks(wall: HouseWall, floorY: number, top: number, share: number, seed: number, openings: readonly WallOpening[] = wall.openings): BoxSpec[] {
  const windows = openings.filter(opening => opening.sill > 0)
  const round = windows.length + 1
  const count = Math.round((windows.length * STREAKS_PER_SILL + LOOK.eaveStreaks) * share)
  const random = seededRandom(seed)
  const boxes: BoxSpec[] = []
  for (let streak = 0; streak < count; streak++) {
    const width = between(LOOK.streakWidth, random())
    const reach = random()
    const spot = random()
    const slot = streak < round * STREAKS_PER_SILL ? streak % round : windows.length
    let along: readonly [number, number]
    let height: readonly [number, number]
    if (slot < windows.length) {
      const ledge = sillLedgeBox(wall, windows[slot], floorY, HOUSE.wallThickness)
      const axis = wall.run === 'x' ? 0 : 2
      const [from, to] = [ledge.position[axis] - ledge.size[axis] / 2, ledge.position[axis] + ledge.size[axis] / 2]
      const wide = Math.min(width, to - from)
      const centre = from + wide / 2 + spot * (to - from - wide)
      const under = ledge.position[1] - ledge.size[1] / 2
      along = [centre - wide / 2, centre + wide / 2]
      height = [Math.max(under - between(LOOK.streakLength, reach), floorY + STREAK_FLOOR_CLEAR), under]
    }
    else {
      const centre = wall.from + STREAK_END_MARGIN + spot * (wall.to - wall.from - STREAK_END_MARGIN * 2)
      along = [centre - width / 2, centre + width / 2]
      // Over a window the streak runs down to its head and stops.
      const stop = openings
        .filter(opening => along[1] > opening.along - opening.width / 2 && along[0] < opening.along + opening.width / 2)
        .reduce((lowest, opening) => Math.max(lowest, floorY + opening.head), top - between(LOOK.eaveLength, reach))
      height = [Math.max(stop, floorY + STREAK_FLOOR_CLEAR), top]
    }
    if (height[1] - height[0] < STREAK_SHORTEST || overlaps(openings, floorY, along, height)) {
      continue
    }
    boxes.push(stain(wall, along, height))
  }
  return boxes
}

// A dusty layer lying on each window's sill ledge, the same at every level but None.
export function sillDirt(wall: HouseWall, floorY: number, wallThickness: number, share: number): BoxSpec[] {
  if (share === 0) {
    return []
  }
  return wall.openings.filter(opening => opening.sill > 0).map((opening) => {
    const { size, position } = sillLedgeBox(wall, opening, floorY, wallThickness)
    const thickness = LOOK.sillDirtThickness
    return { size: [size[0], thickness, size[2]], position: [position[0], position[1] + size[1] / 2 + thickness / 2, position[2]] }
  })
}

// The fade's unevenness: soft pale patches, more of them on a wall the sun falls on. `share` is the Condition's, a share of the
// Worn look, not a level. A patch that would cover an opening is dropped, its draws still taken, so a higher share keeps every
// patch a lower one placed. On a stretched wall each patch is laid out at its real size, no taller than the wall.
export function fadeBlotches(wall: HouseWall, floorY: number, top: number, share: number, seed: number, sunlit: boolean, openings: readonly WallOpening[] = wall.openings, stretch = 1): BoxSpec[] {
  const count = Math.round((wall.to - wall.from) * LOOK.blotchesPerMetre[sunlit ? 'sunlit' : 'shaded'] * share)
  const random = seededRandom(seed)
  const boxes: BoxSpec[] = []
  for (let blotch = 0; blotch < count; blotch++) {
    const width = Math.min(between(LOOK.blotchWidth, random()), wall.to - wall.from)
    const height = Math.min(width * between(LOOK.blotchAspect, random()), (top - floorY) * stretch) / stretch
    const centre = wall.from + width / 2 + random() * (wall.to - wall.from - width)
    const middle = floorY + height / 2 + random() * (top - floorY - height)
    const along = [centre - width / 2, centre + width / 2] as const
    const rise = [middle - height / 2, middle + height / 2] as const
    if (overlaps(openings, floorY, along, rise)) {
      continue
    }
    boxes.push(stain(wall, along, rise))
  }
  return boxes
}
