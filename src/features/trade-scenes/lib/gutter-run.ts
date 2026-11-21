import type { BoxSpec, GutterRun, GutterStation, Vec3 } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { GUTTER_OUT, GUTTER_Y, HOUSE, ROOF_HALF_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { gutterStreaks } from '@/features/trade-scenes/lib/gutter-marks'

const R = ROOF_HALF_LENGTH
const { station: STATION, hangerSpacing: HANGER_SPACING, profile: { outline: OUTLINE, cap: CAP } } = ROOF_TRIM.gutter
const { sag: SAGS, pulled: PULLED, streaks: STREAKS } = WEAR_LOOKS.gutter
// A working number, set by shot: a hidden hanger is a thin strap across the gutter's open top.
const HANGER = { thickness: 0.012, height: 0.006 }
// The strap runs between the sheet's inner faces, level with the back's top edge and in under the front's rolled lip, so it neither
// stands above the gutter nor shows through its face.
const SHEET = OUTLINE.at(-1)![0] - OUTLINE[0][0]
const HANGER_SPAN = [OUTLINE.at(-1)![0], CAP.at(-1)![0] - SHEET] as const
const HANGER_TOP = OUTLINE[0][1]
const DIVIDE_EPSILON = 1e-9

type Face = GutterRun['face']

export const sideOf = (face: Face) => face === 'front' ? 1 : -1

// Where the kept front run's sag ends: at the rake, or where the pulled end starts at Failing.
const sagEnd = (wear: Wear) => wear === 'failing' ? R - PULLED.length : R

export function gutterRunSpans(wear: Wear): { sagLow: number | null, pulled: readonly [number, number] | null } {
  if (wear !== 'worn' && wear !== 'failing') {
    return { sagLow: null, pulled: null }
  }
  return { sagLow: (HOUSE.cutX + sagEnd(wear)) / 2, pulled: wear === 'failing' ? [sagEnd(wear), R] : null }
}

export function gutterCatches(wear: Wear | null, x: number): boolean {
  if (wear === null) {
    return false
  }
  return wear !== 'failing' || x <= sagEnd(wear)
}

export function stationPoint(face: Face, station: GutterStation): Vec3 {
  return [station.x, GUTTER_Y - station.drop, sideOf(face) * (GUTTER_OUT + station.out)]
}

const STRAIGHT = { drop: 0, out: 0, roll: 0 }

// The kept front run's wear at x: a sine-squared dip between the cut and the sag's end, then at Failing the pulled end bending
// away from the sag's own line.
function frontWearAt(wear: Wear, x: number): Omit<GutterStation, 'x'> {
  if (wear !== 'worn' && wear !== 'failing') {
    return STRAIGHT
  }
  const end = sagEnd(wear)
  if (x <= HOUSE.cutX) {
    return STRAIGHT
  }
  if (wear === 'failing' && x >= end) {
    const t = (x - end) / (R - end)
    return { drop: PULLED.drop * t * t, out: PULLED.out * t * t, roll: PULLED.tilt * t * t }
  }
  const dip = Math.sin(Math.PI * (x - HOUSE.cutX) / (end - HOUSE.cutX)) ** 2
  return { drop: SAGS[wear] * dip, out: 0, roll: 0 }
}

// The run is drawn straight between its stations, so a straight stretch needs a station only at each end: the grid is kept only where
// the wear bends the run, and at the same x it always had, so the bend is drawn as finely as before.
function stationsBetween(from: number, to: number, extra: readonly number[], bends: readonly (readonly [number, number])[], wearAt: (x: number) => Omit<GutterStation, 'x'>): GutterStation[] {
  const steps = Math.ceil((to - from) / STATION - DIVIDE_EPSILON)
  const grid = Array.from({ length: steps + 1 }, (_, index) => index === steps ? to : from + (to - from) * index / steps)
    .filter((x, index) => index === 0 || index === steps || bends.some(([low, high]) => x >= low && x <= high))
  const xs = [...grid, ...extra.filter(x => x > from && x < to)]
    .sort((a, b) => a - b)
    .filter((x, index, all) => index === 0 || x - all[index - 1]! > DIVIDE_EPSILON)
  return xs.map(x => ({ x, ...wearAt(x) }))
}

// The front run cut where the near slope is: the Complete house's part stays straight, and the kept part carries the wear, so
// Partly open still shows it. The back gutter runs the whole eave and is never seen from the front.
export function gutterRuns(wear: Wear): { kept: readonly GutterRun[], complete: readonly GutterRun[] } {
  const spans = gutterRunSpans(wear)
  const streakEdges = gutterStreaks(wear).flatMap(x => [STREAKS.width / 2, STREAKS.width / 2 + STREAKS.feather].flatMap(along => [x - along, x + along]))
  const wearAt = (x: number) => frontWearAt(wear, x)
  const marks = [...streakEdges, ...(spans.sagLow === null ? [] : [spans.sagLow]), ...(spans.pulled === null ? [] : [spans.pulled[0]])]
  const bends = [...(spans.sagLow === null ? [] : [[HOUSE.cutX, sagEnd(wear)] as const]), ...(spans.pulled === null ? [] : [spans.pulled])]
  return {
    kept: [
      { face: 'back', stations: stationsBetween(-R, R, [], [], () => STRAIGHT), capStart: true, capEnd: true },
      { face: 'front', stations: stationsBetween(HOUSE.cutX, R, marks, bends, wearAt), capStart: false, capEnd: true },
    ],
    complete: [{ face: 'front', stations: stationsBetween(-R, HOUSE.cutX, streakEdges, [], () => STRAIGHT), capStart: true, capEnd: false }],
  }
}

function between(stations: readonly GutterStation[], x: number): GutterStation {
  const upper = Math.max(1, stations.findIndex(station => station.x >= x))
  const [a, b] = [stations[upper - 1]!, stations[upper]!]
  const t = (x - a.x) / (b.x - a.x)
  return { x, drop: a.drop + (b.drop - a.drop) * t, out: a.out + (b.out - a.out) * t, roll: a.roll + (b.roll - a.roll) * t }
}

export function gutterDropAt(wear: Wear, face: Face, x: number): number {
  const { kept, complete } = gutterRuns(wear)
  const run = [...kept, ...complete].find(candidate => candidate.face === face && x >= candidate.stations[0]!.x && x <= candidate.stations.at(-1)!.x)
  return run ? between(run.stations, x).drop : 0
}

// The straps follow each station's drop and stop where the run has come off them.
export function gutterHangers(runs: readonly GutterRun[]): BoxSpec[] {
  return runs.flatMap((run) => {
    const [from, to] = [run.stations[0]!.x, run.stations.at(-1)!.x]
    const count = Math.ceil((to - from) / HANGER_SPACING - DIVIDE_EPSILON)
    return Array.from({ length: count }, (_, index) => between(run.stations, from + (to - from) * (index + 0.5) / count))
      .filter(station => station.out === 0)
      .map((station): BoxSpec => {
        const [x, y, z] = stationPoint(run.face, { ...station, out: station.out + (HANGER_SPAN[0] + HANGER_SPAN[1]) / 2 })
        return { size: [HANGER.thickness, HANGER.height, HANGER_SPAN[1] - HANGER_SPAN[0]], position: [x, y + HANGER_TOP - HANGER.height / 2, z] }
      })
  })
}
