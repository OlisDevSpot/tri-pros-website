import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, CutawayCrossing, CutawaySteps, TintedBoxes } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart, Weather } from '@/shared/modules/construction/core/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'
import { FELT_WEAR } from '@/features/trade-scenes/constants/wear-looks'
import { cutawayCrossings } from '@/features/trade-scenes/lib/cutaway-rain-path'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

export interface FeltArea {
  up: readonly [number, number]
  along: readonly [number, number]
}

export interface FeltMark extends FeltArea {
  kind: 'crack' | 'tear' | 'hole'
}

// Felt the build did not lay: a retained or worn underlayment is dried out, an installed one is new. One rule for the felt's
// look and its rain hole.
export function isAgedFelt(underlayment: PartState): boolean {
  return underlayment.material === 'felt' && underlayment.wear > 0
}

const between = (random: () => number, [low, high]: readonly [number, number]) => low + (high - low) * random()

// A rectangle of length `length` somewhere inside [low, high], or the whole span when it is shorter.
function within(random: () => number, [low, high]: readonly [number, number], length: number): [number, number] {
  const fit = Math.min(length, high - low)
  const start = low + (high - low - fit) * random()
  return [start, start + fit]
}

// Flat rectangles in the felt's own plane: `up` runs up the slope, `along` across the rolls. Tears sit on every lap line, a
// few holes where pieces crumbled away, and cracks everywhere between.
export function feltWearMarks(area: FeltArea, seed: number): FeltMark[] {
  const random = seededRandom(seed)
  const marks: FeltMark[] = []

  for (let lap = area.up[0] + FELT_WEAR.course; lap < area.up[1]; lap += FELT_WEAR.course) {
    const count = Math.round(between(random, FELT_WEAR.tearsPerLap))
    for (let tear = 0; tear < count; tear++) {
      const width = between(random, FELT_WEAR.tearWidth)
      // The lap line runs through every tear, off its middle by a different share each time, so the edge looks ragged.
      const share = 0.2 + 0.6 * random()
      const up: [number, number] = [Math.max(lap - width * share, area.up[0]), Math.min(lap + width * (1 - share), area.up[1])]
      marks.push({ kind: 'tear', up, along: within(random, area.along, between(random, FELT_WEAR.tearLength)) })
    }
  }
  for (let hole = 0; hole < FELT_WEAR.holes; hole++) {
    marks.push({ kind: 'hole', up: within(random, area.up, between(random, FELT_WEAR.holeSize)), along: within(random, area.along, between(random, FELT_WEAR.holeSize)) })
  }
  for (let crack = 0; crack < FELT_WEAR.cracks; crack++) {
    const length = between(random, FELT_WEAR.crackLength)
    const acrossRolls = random() < 0.5
    marks.push(acrossRolls
      ? { kind: 'crack', up: within(random, area.up, length), along: within(random, area.along, FELT_WEAR.crackWidth) }
      : { kind: 'crack', up: within(random, area.up, FELT_WEAR.crackWidth), along: within(random, area.along, length) })
  }
  return marks
}

// The marks cut to a rectangle, any mark left with nothing dropped, so a roof placed once over its whole run draws only what
// lies on the part showing.
export function feltMarksWithin(marks: readonly FeltMark[], area: FeltArea): FeltMark[] {
  return marks.flatMap((mark) => {
    const up: [number, number] = [Math.max(mark.up[0], area.up[0]), Math.min(mark.up[1], area.up[1])]
    const along: [number, number] = [Math.max(mark.along[0], area.along[0]), Math.min(mark.along[1], area.along[1])]
    return up[1] - up[0] < 0.001 || along[1] - along[0] < 0.001 ? [] : [{ ...mark, up, along }]
  })
}

interface FeltPlane {
  // The felt's top face.
  top: number
  thickness: number
  // The axis the marks' `up` runs on: x on a gable slope's own frame, z on a flat roof.
  upAxis: 0 | 2
  holeColour: string
  crackColour: string
  tearColour: string
}

// Working numbers, set by screenshot: how far a crack or tear stands over the felt's top, and how thick it is.
const MARK_LIFT = 0.0003
const MARK_THICKNESS = 0.0015

// The marks as three tinted lists on the felt: a hole is cut through its thickness and shows the deck's colour.
export function feltMarkLists(marks: readonly FeltMark[], plane: FeltPlane): TintedBoxes[] {
  const box = (mark: FeltMark, bottom: number, height: number): BoxSpec => {
    const up = mark.up[1] - mark.up[0]
    const along = mark.along[1] - mark.along[0]
    const upAt = (mark.up[0] + mark.up[1]) / 2
    const alongAt = (mark.along[0] + mark.along[1]) / 2
    const y = bottom + height / 2
    return plane.upAxis === 0
      ? { size: [up, height, along], position: [upAt, y, alongAt] }
      : { size: [along, height, up], position: [alongAt, y, upAt] }
  }
  const lists: [FeltMark['kind'], string, number, number][] = [
    ['tear', plane.tearColour, plane.top + MARK_LIFT, MARK_THICKNESS],
    ['crack', plane.crackColour, plane.top + MARK_LIFT * 2, MARK_THICKNESS],
    ['hole', plane.holeColour, plane.top - plane.thickness, plane.thickness + MARK_LIFT * 3 + MARK_THICKNESS],
  ]
  return lists.map(([kind, color, bottom, height]) => ({ color, boxes: marks.filter(mark => mark.kind === kind).map(mark => box(mark, bottom, height)) }))
}

const { pitch } = HOUSE

// Where the rain gets through the old felt in Rain, up close on the roof: a patch of the felt's thickness centred on the
// rain's crossing, so the water reads as passing down through it. Synthetic underlayment, or no rain, has none.
export function feltRainHole(form: RoofForm, parts: readonly ResolvedPart[], steps: CutawaySteps, weather: Weather): BoxSpec | null {
  if (weather !== 'rain' || steps.system !== 'roof' || steps.peel <= 0 || !isAgedFelt(partState(parts, 'underlayment'))) {
    return null
  }
  const crossing: CutawayCrossing | undefined = cutawayCrossings(form, parts, steps, 'rain').find(candidate => candidate.partId === 'underlayment')
  if (!crossing) {
    return null
  }
  const { tread, outer, inner } = crossing
  const thickness = Math.hypot(outer[0] - inner[0], outer[1] - inner[1], outer[2] - inner[2]) + CUTAWAY_ROT.lift * 2
  return {
    size: [FELT_WEAR.rainHole, thickness, FELT_WEAR.rainHole],
    position: [tread[0], tread[1] + (inner[1] - outer[1]) / 2, tread[2] + (inner[2] - outer[2]) / 2],
    rotation: [form === 'pitched' ? pitch : 0, 0, 0],
  }
}
