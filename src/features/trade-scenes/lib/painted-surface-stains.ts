import type { BoxSpec, HouseWall, PaintedSurface, PeelingBoxes, StainBox, StainBoxes, SurfaceStains, WallOpening } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { GABLE_VENT } from '@/features/trade-scenes/constants/home-details'
import { FRONT_OPENINGS, FRONT_WALL, HOUSE, HOUSE_WALLS, PARAPET_TOP, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { PEELING_SEEDS, STAIN_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { homeGableVent } from '@/features/trade-scenes/lib/gable-vent-boxes'
import { wallPeeling } from '@/features/trade-scenes/lib/paint-peeling'
import { LEFT_PARAPET_CUT } from '@/features/trade-scenes/lib/roof-cracks'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'
import { fadeBlotches, runoffStreaks } from '@/features/trade-scenes/lib/stain-boxes'

type StainSide = 'back' | 'left' | 'right' | 'front'
type GableSide = 'left' | 'right'

interface StainSurface {
  side: StainSide
  wall: HouseWall
  sunlit: boolean
  openings: readonly WallOpening[]
}

// A box laid up to the seam can come back a rounding past it, which would cut off a sliver no one could see.
const SEAM_TOLERANCE = 1e-9

const facesSun = (wall: HouseWall) => facesSummerSun(wall.run === 'z' ? wall.outward : 0, wall.run === 'x' ? wall.outward : 0)

// The stains and the peeling run out to each corner, over the end of the wall that meets it there: the back wall's ends behind
// the side walls, and the front corners past the front wall's ends. Stopped at the walls' own ends, a corner would show a clean
// strip.
export const STAIN_WALLS = (Object.keys(HOUSE_WALLS) as (keyof typeof HOUSE_WALLS)[]).map((side) => {
  const wall: HouseWall = HOUSE_WALLS[side]
  return { side, wall: wall.run === 'z' ? { ...wall, from: -HOUSE.halfDepth } : wall, sunlit: facesSun(wall) }
})
export const FRONT_STAIN_WALL: HouseWall = { ...FRONT_WALL, from: -HOUSE.halfLength, to: HOUSE.halfLength }

const SURFACES: Record<StainSide, StainSurface> = {
  ...Object.fromEntries(STAIN_WALLS.map(({ side, wall, sunlit }) => [side, { side, wall, sunlit, openings: wall.openings }])) as Record<keyof typeof HOUSE_WALLS, StainSurface>,
  front: { side: 'front', wall: FRONT_STAIN_WALL, sunlit: facesSun(FRONT_STAIN_WALL), openings: FRONT_OPENINGS },
}

const isGable = (side: StainSide): side is GableSide => side === 'left' || side === 'right'

// The gable's vent as an opening in its wall, measured from the floor as a window is, centred where the vent is drawn.
export function gableVentOpening(side: GableSide): WallOpening {
  const { backing } = homeGableVent(side === 'left' ? -1 : 1)
  const sill = backing.position[1] - GABLE_VENT.height / 2 - HOUSE.floorY
  return { along: backing.position[2], width: GABLE_VENT.width, sill, head: sill + GABLE_VENT.height }
}

// How high a wall's paint runs at each point along it: up the gable to the rake on a pitched roof's end walls, to the eave line on
// its other two, and up the parapet to the cap's underside on a flat roof.
export function paintTopEdge(side: StainSide, form: RoofForm): (along: number) => number {
  if (form !== 'pitched') {
    return () => PARAPET_TOP
  }
  return isGable(side) ? z => roofUndersideY(z, 'pitched') : () => WALL_TOP_Y
}

function paintedSurface(side: StainSide, form: RoofForm): PaintedSurface {
  return { topEdge: paintTopEdge(side, form), vents: form === 'pitched' && isGable(side) ? [gableVentOpening(side)] : [] }
}

const spanOf = (box: BoxSpec, axis: 0 | 1 | 2) => [box.position[axis] - box.size[axis] / 2, box.position[axis] + box.size[axis] / 2] as const

function cut<T extends BoxSpec>(box: T, axis: 0 | 1 | 2, from: number, to: number): T {
  const size = [...box.size] as [number, number, number]
  const position = [...box.position] as [number, number, number]
  size[axis] = to - from
  position[axis] = (from + to) / 2
  return { ...box, size, position }
}

// The wall draws in the house shell's fade groups and the gable or parapet in the roof's, so a stain running across the seam is
// two boxes, one each side. Each shows its own share of the atlas cell's height, so the two read as one stain.
export function splitAtSeam(boxes: readonly StainBox[], seam: number): { below: StainBox[], above: StainBox[] } {
  const below: StainBox[] = []
  const above: StainBox[] = []
  for (const box of boxes) {
    const [bottom, top] = spanOf(box, 1)
    if (top <= seam + SEAM_TOLERANCE) {
      below.push(box)
      continue
    }
    if (bottom >= seam - SEAM_TOLERANCE) {
      above.push(box)
      continue
    }
    const [v0, v1] = box.v ?? [0, 1]
    const at = v0 + (seam - bottom) / (top - bottom) * (v1 - v0)
    below.push({ ...cut(box, 1, bottom, seam), v: [v0, at] })
    above.push({ ...cut(box, 1, seam, top), v: [at, v1] })
  }
  return { below, above }
}

// The same cut across the run, at `at`. A stain is flat across its wall, so its run is the horizontal axis it has length on. Its
// atlas cell runs left to right as seen from outside, and the house stands on the origin, so a face's outside is the side of the
// origin it lies on: the cell runs with the run's coordinate on the faces looking toward −x and +z, and against it on the others.
export function splitAlong(boxes: readonly StainBox[], at: number): { before: StainBox[], after: StainBox[] } {
  const before: StainBox[] = []
  const after: StainBox[] = []
  for (const box of boxes) {
    const axis = box.size[0] === 0 ? 2 : 0
    const [start, end] = spanOf(box, axis)
    if (end <= at + SEAM_TOLERANCE) {
      before.push(box)
      continue
    }
    if (start >= at - SEAM_TOLERANCE) {
      after.push(box)
      continue
    }
    const outward = Math.sign(box.position[axis === 2 ? 0 : 2])
    const withRun = axis === 2 ? outward < 0 : outward > 0
    const [u0, u1] = box.u ?? [0, 1]
    const share = (at - start) / (end - start)
    const middle = withRun ? u0 + share * (u1 - u0) : u1 - share * (u1 - u0)
    before.push({ ...cut(box, axis, start, at), u: withRun ? [u0, middle] : [middle, u1] })
    after.push({ ...cut(box, axis, at, end), u: withRun ? [middle, u1] : [u0, middle] })
  }
  return { before, after }
}

const joined = (...faces: SurfaceStains[]): SurfaceStains => ({ streaks: faces.flatMap(face => face.streaks), blotches: faces.flatMap(face => face.blotches) })
const noStains = (): SurfaceStains => ({ streaks: [], blotches: [] })

// Every painted surface stains up to its top edge: each wall with the gable or parapet above it is laid out as one surface, then
// cut at the wall top into the half the house shell draws and the half the roof draws.
export function paintedSurfaceStains(form: RoofForm, stainShare: number, fadeShare: number): {
  walls: { sides: SurfaceStains, front: SurfaceStains }
  gables: { left: SurfaceStains, right: SurfaceStains }
  parapets: { kept: SurfaceStains, complete: SurfaceStains }
} {
  const halves = (side: StainSide) => {
    const { wall, sunlit, openings } = SURFACES[side]
    const face = paintedSurface(side, form)
    const streakSeed = isGable(side) && face.vents.length > 0 ? STAIN_SEEDS.vent[side] : STAIN_SEEDS.streaks[side]
    const streaks = splitAtSeam(runoffStreaks(wall, HOUSE.floorY, WALL_TOP_Y, stainShare, streakSeed, openings, face), WALL_TOP_Y)
    const blotches = splitAtSeam(fadeBlotches(wall, HOUSE.floorY, WALL_TOP_Y, fadeShare, STAIN_SEEDS.blotches[side], sunlit, openings, 1, face), WALL_TOP_Y)
    return { below: { streaks: streaks.below, blotches: blotches.below }, above: { streaks: streaks.above, blotches: blotches.above } }
  }
  const [back, left, right, front] = (['back', 'left', 'right', 'front'] as const).map(halves)
  const walls = { sides: joined(back.below, left.below, right.below), front: front.below }
  if (form === 'pitched') {
    return { walls, gables: { left: left.above, right: right.above }, parapets: { kept: noStains(), complete: noStains() } }
  }
  // The left parapet's front half lifts away with the Complete house. A stain sent whole to it would leave the kept back half
  // missing its part, under a wall half that stays, and the seam would show again; so it is cut where the parapet is.
  const [streaks, blotches] = [splitAlong(left.above.streaks, LEFT_PARAPET_CUT), splitAlong(left.above.blotches, LEFT_PARAPET_CUT)]
  return {
    walls,
    gables: { left: noStains(), right: noStains() },
    parapets: {
      kept: joined(back.above, right.above, { streaks: streaks.before, blotches: blotches.before }),
      complete: joined(front.above, { streaks: streaks.after, blotches: blotches.after }),
    },
  }
}

// The see-through lists one painted face draws, each at its level's strength.
export function surfaceStainLists(face: SurfaceStains, stainShare: number, fadeShare: number): StainBoxes[] {
  const look = WEAR_LOOKS.paint
  return [
    { cell: 'streak', boxes: face.streaks, color: look.streakColor, alpha: Math.min(1, look.streakAlpha * stainShare) },
    { cell: 'blotch', boxes: face.blotches, color: look.blotchColor, alpha: Math.min(1, look.blotchAlpha * fadeShare) },
  ]
}

// How high a box reaches once turned: a flake leans off its face.
function topOf(box: BoxSpec): number {
  const [x, y, z] = box.rotation ?? [0, 0, 0]
  const [a, b, c, d, e, f] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)]
  const [width, height, depth] = box.size
  return box.position[1] + (Math.abs(a * f + b * e * d) * width + Math.abs(a * e - b * f * d) * height + Math.abs(b * c) * depth) / 2
}

const noPeeling = (): PeelingBoxes => ({ bare: [], lifted: [] })

// Peeling up the gables and the parapets, by the walls' own rule, measured from the wall top and with no foot, so no row of
// patches sits on the seam. A patch or a flake that would reach past the top edge is dropped, its draws still taken. A flake
// leans only about its wall's run, so its span along the run is its box's.
export function roofPeeling(form: RoofForm, share: number): {
  gables: { left: PeelingBoxes, right: PeelingBoxes }
  parapets: { kept: PeelingBoxes[], complete: PeelingBoxes[] }
} {
  const peel = (side: StainSide, seed: number): PeelingBoxes => {
    const { wall } = SURFACES[side]
    const face = paintedSurface(side, form)
    const highest = Math.max(face.topEdge(wall.from), face.topEdge((wall.from + wall.to) / 2), face.topEdge(wall.to))
    const { bare, lifted } = wallPeeling(wall, HOUSE.floorY, WALL_TOP_Y, share, seed, face.vents, 1, highest, false)
    const axis = wall.run === 'x' ? 0 : 2
    const under = (box: BoxSpec) => {
      const [start, end] = spanOf(box, axis)
      return topOf(box) <= Math.min(face.topEdge(start), face.topEdge(end))
    }
    return { bare: bare.filter(under), lifted: lifted.filter(under) }
  }
  if (form === 'pitched') {
    return { gables: { left: peel('left', PEELING_SEEDS.gable.left), right: peel('right', PEELING_SEEDS.gable.right) }, parapets: { kept: [], complete: [] } }
  }
  // The left parapet's peeling splits where its stains do.
  const left = peel('left', PEELING_SEEDS.parapet.left)
  const split = (boxes: readonly BoxSpec[]) => {
    const behind: BoxSpec[] = []
    const ahead: BoxSpec[] = []
    for (const box of boxes) {
      const [start, end] = spanOf(box, 2)
      if (start < LEFT_PARAPET_CUT) {
        behind.push(end <= LEFT_PARAPET_CUT ? box : cut(box, 2, start, LEFT_PARAPET_CUT))
      }
      if (end > LEFT_PARAPET_CUT) {
        ahead.push(start >= LEFT_PARAPET_CUT ? box : cut(box, 2, LEFT_PARAPET_CUT, end))
      }
    }
    return { behind, ahead }
  }
  const [bare, lifted] = [split(left.bare), split(left.lifted)]
  return {
    gables: { left: noPeeling(), right: noPeeling() },
    parapets: {
      kept: [peel('back', PEELING_SEEDS.parapet.back), peel('right', PEELING_SEEDS.parapet.right), { bare: bare.behind, lifted: lifted.behind }],
      complete: [peel('front', PEELING_SEEDS.parapet.front), { bare: bare.ahead, lifted: lifted.ahead }],
    },
  }
}
