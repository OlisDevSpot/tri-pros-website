import type { BoxSpec, HouseWall, PeelingBoxes, TintedBoxes, WallOpening } from '@/features/trade-scenes/types'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { FRONT_DOOR_FRAME, FRONT_WALL, HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { FRONT_DOOR_BOXES } from '@/features/trade-scenes/lib/front-door-boxes'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'

const { peeling: LOOK } = WEAR_LOOKS.paint
const { bareThickness: BARE_THICKNESS, flakeThickness: FLAKE_THICKNESS } = LOOK
// Working numbers, tuned by eye: how far a patch keeps off an opening's edge, and the smallest piece a clip may leave.
const OPENING_MARGIN = 0.02
const SMALLEST = 0.01
const WALL_FACE = HOUSE.wallThickness / 2
const FRAME_FACE = FRONT_DOOR_FRAME.depth / 2
const FASCIA_FACE = ROOF_TRIM.fascia.thickness / 2

type Span = readonly [number, number]

const between = ([low, high]: Span, at: number) => low + (high - low) * at

function barePatch(wall: HouseWall, face: number, along: Span, height: Span): BoxSpec {
  return wallBox(wall, along, height, face + BARE_THICKNESS / 2, BARE_THICKNESS)
}

// Still held along its patch's top rim, hanging over the bare patch with its free edge lifted off it. In a frame stretched
// upward by `stretch` the flake is laid out at its real length and lean: a turned box's height divided by the stretch would not
// keep its shape.
function hangingFlake(wall: HouseWall, face: number, along: Span, rim: number, length: number, stretch: number): BoxSpec {
  const drop = length * Math.cos(LOOK.flakeLean) / stretch
  const out = length * Math.sin(LOOK.flakeLean)
  const drawn = Math.hypot(drop, out)
  const lean = Math.atan2(out, drop)
  // Lowered by what its thickness reaches up under the lean, so no corner stands above the rim.
  const middle = rim - drop / 2 - FLAKE_THICKNESS / 2 * Math.sin(lean)
  // Its held edge rests on the bare patch, so the box's centre stands half its lift further out.
  const box = wallBox(wall, along, [middle - drawn / 2, middle + drawn / 2], face + BARE_THICKNESS + FLAKE_THICKNESS / 2 + out / 2, FLAKE_THICKNESS)
  return { ...box, rotation: wall.run === 'x' ? [-wall.outward * lean, 0, 0] : [0, 0, wall.outward * lean] }
}

const spanOf = (box: BoxSpec, axis: 0 | 1): Span => [box.position[axis] - box.size[axis] / 2, box.position[axis] + box.size[axis] / 2]

// Peeling where water gets behind a wall's paint: small clusters at its foot, just under each sill and at its outside corners,
// never whole sheets. Each cluster takes the same draws whatever comes of them, so a higher share keeps every patch a lower one
// placed and adds more. `bottom` is the wall's foot; heights are laid out in metres above it at their real size within a frame
// stretched upward by `stretch`, and stay under `top`; `foot: false` leaves the foot's clusters out.
export function wallPeeling(wall: HouseWall, floorY: number, bottom: number, share: number, seed: number, openings: readonly WallOpening[] = wall.openings, stretch = 1, top = floorY + HOUSE.wallHeight, foot = true): PeelingBoxes {
  const metres = (y: number) => (y - bottom) * stretch
  const drawn = (above: number) => bottom + above / stretch
  const height = metres(top)
  const count = Math.round((wall.to - wall.from) * LOOK.clustersPerMetre * Math.min(1, height / LOOK.clusterHeight) * share)
  // Every other cluster goes to the foot, where the water sits longest. A raised face has none: its bottom edge is a seam with
  // the wall below, not a place water collects.
  const places = [...openings.filter(opening => opening.sill > 0), 'from', 'to'] as const
  const spots = foot ? places.flatMap(spot => ['foot', spot] as const) : places
  const clear = (along: Span, rise: Span) => openings.every(opening => along[1] <= opening.along - opening.width / 2 - OPENING_MARGIN
    || along[0] >= opening.along + opening.width / 2 + OPENING_MARGIN
    || rise[1] <= metres(floorY + opening.sill) - OPENING_MARGIN || rise[0] >= metres(floorY + opening.head) + OPENING_MARGIN)
  const random = seededRandom(seed)
  const bare: BoxSpec[] = []
  const lifted: BoxSpec[] = []
  for (let cluster = 0; cluster < count; cluster++) {
    const spot = spots[cluster % spots.length]
    const [across, up] = [random(), random()]
    const draws = Array.from({ length: LOOK.patches }, () => [random(), random(), random(), random()] as const)
    const flake = [random(), random(), random()] as const
    let centre: number
    let rise: number
    let ceiling = height
    if (spot === 'foot') {
      centre = between([wall.from, wall.to], across)
      rise = up * LOOK.footReach
    }
    else if (spot === 'from' || spot === 'to') {
      centre = spot === 'from' ? wall.from + across * LOOK.endReach : wall.to - across * LOOK.endReach
      rise = up * height
    }
    else {
      ceiling = metres(floorY + spot.sill) - LOOK.sillGap
      centre = spot.along + (across - 0.5) * spot.width
      rise = ceiling - up * LOOK.sillReach
    }
    const patches = draws.map(([offset, lift, wide, tall]) => {
      const width = between(LOOK.patchWidth, wide)
      const middle = centre + (offset - 0.5) * LOOK.spread[0]
      const level = rise + (lift - 0.5) * LOOK.spread[1]
      const half = between(LOOK.patchHeight, tall) / 2
      const along = [Math.max(wall.from, middle - width / 2), Math.min(wall.to, middle + width / 2)] as const
      const span = [Math.max(0, level - half), Math.min(ceiling, level + half)] as const
      return along[1] - along[0] >= SMALLEST && span[1] - span[0] >= SMALLEST && clear(along, span) ? { along, span } : null
    })
    for (const patch of patches) {
      if (patch) {
        bare.push(barePatch(wall, WALL_FACE, patch.along, [drawn(patch.span[0]), drawn(patch.span[1])]))
      }
    }
    const [first] = patches
    if (first) {
      const [wide, at, long] = flake
      const room = first.along[1] - first.along[0]
      const width = room * between(LOOK.flakeWidth, wide)
      const left = first.along[0] + at * (room - width)
      const length = Math.min(between(LOOK.flakeLength, long), first.span[1] - first.span[0])
      lifted.push(hangingFlake(wall, WALL_FACE, [left, left + width], drawn(first.span[1]), length, stretch))
    }
  }
  return { bare, lifted }
}

// The front door's frame peels where it meets the step: the lowest 30–40 cm of both jambs, with a ragged top and a flake lifting
// off it. Past those two pieces come thin chips along the frame's outside edges, where it meets the stucco.
export function doorFramePeeling(share: number, seed: number): PeelingBoxes {
  const [leftJamb, rightJamb, head] = FRONT_DOOR_BOXES.frame
  const count = Math.round(LOOK.doorPieces * share)
  const random = seededRandom(seed)
  const bare: BoxSpec[] = []
  const lifted: BoxSpec[] = []
  const [floor] = spanOf(leftJamb, 1)
  const [headUnder, top] = spanOf(head, 1)
  const [left] = spanOf(leftJamb, 0)
  const [, right] = spanOf(rightJamb, 0)
  for (let piece = 0; piece < count; piece++) {
    const [at, long, wide, place, rise, flakeWide, flakeAt, flakeLong] = Array.from({ length: 8 }, random)
    if (piece < 2) {
      const along = spanOf(piece === 0 ? leftJamb : rightJamb, 0)
      const room = along[1] - along[0]
      const foot = floor + between(LOOK.jambFoot, at)
      const tongue = room * between(LOOK.tongueWidth, wide)
      const tongueLeft = along[0] + place * (room - tongue)
      bare.push(barePatch(FRONT_WALL, FRAME_FACE, along, [floor, foot]))
      bare.push(barePatch(FRONT_WALL, FRAME_FACE, [tongueLeft, tongueLeft + tongue], [floor, foot + between(LOOK.tongueReach, rise)]))
      const width = room * between(LOOK.flakeWidth, flakeWide)
      const flakeLeft = along[0] + flakeAt * (room - width)
      lifted.push(hangingFlake(FRONT_WALL, FRAME_FACE, [flakeLeft, flakeLeft + width], foot, between(LOOK.flakeLength, flakeLong), 1))
      continue
    }
    const length = between(LOOK.chipLength, long)
    const edge = (piece - 2) % 3
    if (edge === 2) {
      const start = left + at * (right - left - length)
      bare.push(barePatch(FRONT_WALL, FRAME_FACE, [start, start + length], [top - LOOK.chipWidth, top]))
      continue
    }
    // Up the jamb's outside edge, clear of its foot and of the head.
    const low = floor + LOOK.jambFoot[1] + LOOK.chipClearance
    const start = low + at * (headUnder - low - length)
    const along: Span = edge === 0 ? [left, left + LOOK.chipWidth] : [right - LOOK.chipWidth, right]
    bare.push(barePatch(FRONT_WALL, FRAME_FACE, along, [start, start + length]))
  }
  return { bare, lifted }
}

// Patches along one eave fascia's `run`, in the fascia's own frame: centred on the board, its outer face toward −x, y up and the
// run along z. Most hang off the bottom edge, where the water drips, with a flake at their rim; a few bite in from the top.
export function fasciaPeeling(run: Span, share: number, seed: number): PeelingBoxes {
  const board: HouseWall = { run: 'z', line: 0, outward: -1, from: run[0], to: run[1], openings: [] }
  const half = ROOF_TRIM.fascia.height / 2
  const length = run[1] - run[0]
  const count = Math.round(length * LOOK.fasciaPerMetre * share)
  const random = seededRandom(seed)
  const bare: BoxSpec[] = []
  const lifted: BoxSpec[] = []
  for (let patch = 0; patch < count; patch++) {
    const [at, wide, tall, edge, tongueWide, tongueAt, tongueTall, flakeWide, flakeAt, flakeLong] = Array.from({ length: 10 }, random)
    const width = Math.min(between(LOOK.fasciaPatchWidth, wide), length)
    const along = [run[0] + at * (length - width), run[0] + at * (length - width) + width] as const
    const reach = between(LOOK.fasciaPatchHeight, tall)
    const tongue = width * between(LOOK.fasciaTongueWidth, tongueWide)
    const tongueAlong = [along[0] + tongueAt * (width - tongue), along[0] + tongueAt * (width - tongue) + tongue] as const
    const tongueReach = reach + between(LOOK.tongueReach, tongueTall)
    if (edge >= 1 - LOOK.fasciaTopShare) {
      bare.push(barePatch(board, FASCIA_FACE, along, [half - reach, half]))
      bare.push(barePatch(board, FASCIA_FACE, tongueAlong, [half - tongueReach, half]))
      continue
    }
    bare.push(barePatch(board, FASCIA_FACE, along, [-half, -half + reach]))
    bare.push(barePatch(board, FASCIA_FACE, tongueAlong, [-half, -half + tongueReach]))
    const flakeWidth = width * between(LOOK.flakeWidth, flakeWide)
    const flakeLeft = along[0] + flakeAt * (width - flakeWidth)
    lifted.push(hangingFlake(board, FASCIA_FACE, [flakeLeft, flakeLeft + flakeWidth], -half + reach, Math.min(between(LOOK.flakeLength, flakeLong), reach), 1))
  }
  return { bare, lifted }
}

// Peeled surfaces' marks, for the painted surface's one draw: the bare patches in `bare`, the flakes in the paint's own lifted tone.
export function peelingMarks(peelings: readonly PeelingBoxes[], bare: string): TintedBoxes[] {
  return [
    { boxes: peelings.flatMap(peeling => peeling.bare), color: bare },
    { boxes: peelings.flatMap(peeling => peeling.lifted), color: LOOK.flake },
  ]
}
