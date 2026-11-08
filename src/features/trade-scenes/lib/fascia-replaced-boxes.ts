import type { BoxSpec, FasciaRotSpot, FasciaRun, TintedBoxes, Vec3 } from '@/features/trade-scenes/types'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'
import { FASCIA_ROT } from '@/features/trade-scenes/constants/paint-wear'

type Span = readonly [number, number]

const { height: HEIGHT, thickness: THICKNESS } = ROOF_TRIM.fascia
const { lift: LIFT } = CUTAWAY_ROT
// A length and the rot it takes are worked out from the same joints by different sums, so their ends meet only within a
// rounding error.
const ROUNDING = 1e-9

// Where a rotted end is cut out: `newLength` of new board centred on the rot, a joint's both sides in one piece, kept on the
// run as the rot is. A board rotted along its bottom edge is replaced whole, joint to joint.
function lengthOf(spot: FasciaRotSpot, run: FasciaRun): Span {
  if (spot.bottom) {
    return spot.along
  }
  const half = Math.min(FASCIA_ROT.newLength, run.to - run.from) / 2
  const centre = Math.min(Math.max((spot.along[0] + spot.along[1]) / 2, run.from + half), run.to - half)
  return [centre - half, centre + half]
}

// The new lengths over the whole home's runs, as spots on their faces: lengths that meet or overlap are one piece, so no
// seam falls inside a replaced board. A part of a fascia draws its own share with `fasciaRotWithin`.
export function fasciaNewLengths(spots: readonly FasciaRotSpot[], runs: readonly FasciaRun[]): FasciaRotSpot[] {
  return runs.flatMap((run) => {
    const spans = spots.filter(spot => spot.face === run.face).map(spot => lengthOf(spot, run)).sort((a, b) => a[0] - b[0])
    const pieces: [number, number][] = []
    for (const [from, to] of spans) {
      const last = pieces.at(-1)
      if (last && from <= last[1] + ROUNDING) {
        last[1] = Math.max(last[1], to)
      }
      else {
        pieces.push([from, to])
      }
    }
    return pieces.map(along => ({ face: run.face, along, bottom: false }))
  })
}

function boardBox([from, to]: Span, thickness: number, height: number): BoxSpec {
  return { size: [thickness, height, to - from], position: [0, 0, (from + to) / 2] }
}

// One part's share of the new lengths (one face, cut to the part's `range`), each a square piece standing over the old
// board's faces and edges, over a darker seam a little longer and a hair inside it, so it reads as a piece set in. The seam
// shows only past an end the part keeps. In the gable fascia's own frame: centred on the board, its outer face toward −x, y
// up and the run along z, at that fascia's section; a fascia of another section stands the boxes on its own board.
export function fasciaReplacedBoxes(lengths: readonly FasciaRotSpot[], [from, to]: Span, color: string): [seams: TintedBoxes, boards: TintedBoxes] {
  return [
    { color: HOME_PALETTE.woodSeam, boxes: lengths.map(({ along }) => boardBox([Math.max(from, along[0] - FASCIA_ROT.seam), Math.min(to, along[1] + FASCIA_ROT.seam)], THICKNESS + LIFT, HEIGHT + LIFT)) },
    { color, boxes: lengths.map(({ along }) => boardBox(along, THICKNESS + LIFT * 2, HEIGHT + LIFT * 2)) },
  ]
}

// The group that stands the boxes on a fascia running along x with its outer face toward +z (the garage's, a flat roof's):
// turned from the gable fascia's frame and stretched to the board's own section.
export function fasciaBoardFrame({ size, position }: BoxSpec): { position: Vec3, rotation: Vec3, scale: Vec3 } {
  return { position: [0, position[1], position[2]], rotation: [0, Math.PI / 2, 0], scale: [size[2] / THICKNESS, size[1] / HEIGHT, 1] }
}

// The rot no new length takes: what still shows once the fascia is replaced.
export function fasciaRotLeft(spots: readonly FasciaRotSpot[], lengths: readonly FasciaRotSpot[]): FasciaRotSpot[] {
  return spots.filter(spot => !lengths.some(({ face, along }) => face === spot.face && along[0] <= spot.along[0] + ROUNDING && spot.along[1] <= along[1] + ROUNDING))
}
