import type { BoxSpec, FasciaRotSpot, FasciaRun, HouseWall } from '@/features/trade-scenes/types'
import type { PaintWearLevel } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { ROOF_HALF_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'
import { FASCIA_ROT } from '@/features/trade-scenes/constants/paint-wear'
import { GARAGE_BOXES } from '@/features/trade-scenes/lib/garage-boxes'
import { lowSlopeRoofBoxes } from '@/features/trade-scenes/lib/low-slope-roof-boxes'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'

type Span = readonly [number, number]

const runAlongX = (face: FasciaRun['face'], { size, position }: BoxSpec): FasciaRun => ({ face, from: position[0] - size[0] / 2, to: position[0] + size[0] / 2 })

// Every fascia that can rot: a gable's two eaves, each one run in its slope's frame, and the garage's street-side eave; a flat
// roof's front fascia. A flat garage has no fascia and the coping never rots.
export const FASCIA_RUNS = {
  'pitched': [
    { face: 'front', from: -ROOF_HALF_LENGTH, to: ROOF_HALF_LENGTH },
    { face: 'back', from: -ROOF_HALF_LENGTH, to: ROOF_HALF_LENGTH },
    runAlongX('garage', GARAGE_BOXES.pitched.fascia[0]),
  ],
  'low-slope': [runAlongX('front', lowSlopeRoofBoxes().frontFascia[0])],
} as const satisfies Record<RoofForm, readonly FasciaRun[]>

// Light rot is one board end, moderate two or three, heavy most of them.
function rottedCount(level: PaintWearLevel, ends: number): number {
  switch (level) {
    case 'none':
      return 0
    case 'light':
      return 1
    case 'moderate':
      return ends < 6 ? 2 : 3
    case 'heavy':
      return Math.ceil(0.75 * ends)
  }
}

// A run's board ends in order: its two ends and a joint every board length between them.
function boardEnds(run: FasciaRun): number[] {
  const joints = Array.from({ length: Math.ceil((run.to - run.from) / FASCIA_ROT.boardLength) - 1 }, (_, index) => run.from + (index + 1) * FASCIA_ROT.boardLength)
  return [run.from, ...joints, run.to]
}

// Centred on its end, kept on the run: a run's own end rots inward, as does a joint close to one.
function endSpan(run: FasciaRun, at: number): Span {
  const half = FASCIA_ROT.endWidth / 2
  const centre = Math.min(Math.max(at, run.from + half), run.to - half)
  return [centre - half, centre + half]
}

// The whole home's board ends are shuffled as one set from one seed, so each level keeps the ends a lighter one rotted and
// adds more, and a part of a fascia finds the same spots whichever runs it draws.
export function fasciaRotSpots(level: PaintWearLevel, runs: readonly FasciaRun[]): FasciaRotSpot[] {
  const ends = runs.flatMap((run, index) => boardEnds(run).map(at => ({ index, at })))
  const random = seededRandom(FASCIA_ROT.seed)
  for (let last = ends.length - 1; last > 0; last--) {
    const pick = Math.floor(random() * (last + 1))
    ;[ends[last], ends[pick]] = [ends[pick], ends[last]]
  }
  const rotted = ends.slice(0, rottedCount(level, ends.length))
  const spots: FasciaRotSpot[] = []
  const boards: FasciaRotSpot[] = []
  runs.forEach((run, index) => {
    const mine = rotted.filter(end => end.index === index).map(end => end.at).sort((a, b) => a - b)
    spots.push(...mine.map(at => ({ face: run.face, along: endSpan(run, at), bottom: false })))
    if (level !== 'heavy') {
      return
    }
    const all = boardEnds(run)
    for (let board = 0; board < all.length - 1; board++) {
      if (mine.includes(all[board]) || mine.includes(all[board + 1])) {
        boards.push({ face: run.face, along: [all[board], all[board + 1]], bottom: true })
      }
    }
  })
  return [...spots, ...boards]
}

// The spots one part of a fascia draws: those on its face, cut to its own run, so two parts that meet draw a spot between them.
export function fasciaRotWithin(spots: readonly FasciaRotSpot[], face: FasciaRun['face'], [from, to]: Span): FasciaRotSpot[] {
  return spots.flatMap((spot) => {
    const along = [Math.max(from, spot.along[0]), Math.min(to, spot.along[1])] as const
    return spot.face === face && along[1] > along[0] ? [{ ...spot, along }] : []
  })
}

// The spots as stains lying on the board's outer face: `board` is the fascia in its own frame, `face` how far its outer face
// stands from that line, and `edge` its bottom and top.
export function fasciaRotBoxes(spots: readonly FasciaRotSpot[], board: HouseWall, face: number, [bottom, top]: Span): BoxSpec[] {
  return spots.map(spot => wallBox(board, spot.along, spot.bottom ? [bottom, bottom + FASCIA_ROT.bottomHeight] : [bottom, top], face + CUTAWAY_ROT.lift, CUTAWAY_ROT.lift * 2))
}
