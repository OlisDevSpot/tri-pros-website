import type { RibbonPoint } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart, WaterFlow } from '@/shared/modules/construction/core/types'

import { KIT_DRIP, KIT_FLOW, KIT_ROT } from '@/features/trade-scenes/constants/roof-attic-flows'
import { KIT_GUTTER, LOW_SLOPE_COVERING_BASE, LOW_SLOPE_KIT, PITCHED_COVERING_BASE, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { faceHeights, lift, lineSpans, offsetBy, SLOPED_LINE_PARTS } from '@/features/trade-scenes/lib/kit-line-spans'
import { frontSlopePoint, gutterCentre } from '@/features/trade-scenes/lib/roof-attic-kit-points'

/** A flow's line through the kit and its share (0..1) at each point. */
export interface RibbonPath {
  points: RibbonPoint[]
  widths: number[]
}

const distance = (a: RibbonPoint, b: RibbonPoint) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const midpoint = (a: RibbonPoint, b: RibbonPoint): RibbonPoint => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

// A curve through two points at one spot has no direction there, so a point on top of the last one only updates its share.
function push(path: RibbonPath, point: RibbonPoint, width: number): void {
  const last = path.points.at(-1)
  if (last && distance(last, point) < 1e-3) {
    path.widths[path.widths.length - 1] = width
    return
  }
  path.points.push(point)
  path.widths.push(width)
}

// A part crossed by the flow: its entry face at the share arriving, its exit face at the share leaving; a part too thin to
// show both is one station at its middle with the share leaving.
function crossSpan(path: RibbonPath, entry: RibbonPoint, exit: RibbonPoint, entryWidth: number, exitWidth: number): void {
  if (distance(entry, exit) < KIT_FLOW.faceStationMin) {
    push(path, midpoint(entry, exit), exitWidth)
    return
  }
  push(path, entry, entryWidth)
  push(path, exit, exitWidth)
}

export interface RainRibbonPath {
  path: RibbonPath
  /** Where a drop forms under the ceiling, when the rain gets past it. */
  drip: RibbonPoint | null
}

const SHEDS = new Set(['surface', 'shed-water'])

// The rain walks down from the sky through each part, thinning where a worn part soaks it up. A sound shedding part stops it:
// from there it runs down that part's surface to the eave, over the drip edge and into the gutter (or off the roof without one).
export function rainRibbonPath(form: RoofForm, parts: readonly ResolvedPart[], water: WaterFlow, peel: number): RainRibbonPath | null {
  const spans = lineSpans(form, parts, peel)
  const top = spans.at(-1)
  if (!top) {
    return null
  }
  const path: RibbonPath = { points: [], widths: [] }
  push(path, offsetBy(top.outer, KIT_FLOW.sky[form]), water.boundaries[0] ?? 1)

  for (const span of [...spans].reverse()) {
    const part = parts.find(candidate => candidate.id === span.partId)
    const level = water.parts[span.partId]
    if (!part || !level) {
      continue
    }
    if (SHEDS.has(part.role) && !part.edge && level.outer > KIT_FLOW.stopped && level.inner <= KIT_FLOW.stopped) {
      push(path, offsetBy(span.outer, sheetNormal(form, KIT_FLOW.sheetOver)), level.outer)
      shedRun(path, form, parts, part, water.shed, peel)
      return { path, drip: null }
    }
    crossSpan(path, span.outer, span.inner, level.outer, level.inner)
    if (level.inner <= KIT_FLOW.stopped) {
      return { path, drip: null }
    }
  }

  const ceiling = spans[0]
  const under: RibbonPoint = [ceiling.inner[0], ceiling.inner[1] - 0.03, ceiling.inner[2]]
  push(path, under, water.reachesInside)
  return { path, drip: water.reachesInside > KIT_FLOW.stopped ? [ceiling.inner[0], ceiling.inner[1], KIT_DRIP.z] : null }
}

function sheetNormal(form: RoofForm, over: number): readonly [number, number] {
  if (form === 'low-slope') {
    return [0, over]
  }
  return [-over * Math.sin(PITCHED_KIT.pitch), over * Math.cos(PITCHED_KIT.pitch)]
}

// Down the shedding part's surface to the eave, then over the drip edge (when there is one) and into the gutter, landing in
// its trough a little way in from the cut end so it reads as caught.
function shedRun(path: RibbonPath, form: RoofForm, parts: readonly ResolvedPart[], shedding: ResolvedPart, shed: number, peel: number): void {
  const has = (id: string) => parts.some(part => part.id === id && part.material !== null)
  const sheet = sheetNormal(form, KIT_FLOW.sheetOver)
  const height = faceHeights(form, shedding)?.[1] ?? 0
  const onSurface = (point: RibbonPoint) => offsetBy(lift(form, shedding.id, peel, point), sheet)
  const z = KIT_FLOW.z

  if (form === 'pitched') {
    const eaveAlong = -PITCHED_KIT.overhang + 0.02
    push(path, onSurface(frontSlopePoint((KIT_FLOW.pitchedAlong + eaveAlong) / 2, height, z)), shed)
    push(path, onSurface(frontSlopePoint(eaveAlong, height, z)), shed)
  }
  else {
    const front = -LOW_SLOPE_KIT.halfSpan - LOW_SLOPE_KIT.overhang + 0.02
    push(path, onSurface([(KIT_FLOW.lowSlopeX + front) / 2, height, z]), shed)
    push(path, onSurface([front, height, z]), shed)
  }

  if (has('drip-edge')) {
    const edge: RibbonPoint = form === 'pitched'
      ? frontSlopePoint(-PITCHED_KIT.overhang, PITCHED_COVERING_BASE, z)
      : [-LOW_SLOPE_KIT.halfSpan - LOW_SLOPE_KIT.overhang - LOW_SLOPE_KIT.fascia, LOW_SLOPE_COVERING_BASE, z]
    push(path, offsetBy(lift(form, 'drip-edge', peel, edge), KIT_FLOW.offEdge), shed)
  }

  if (has('gutter')) {
    const [gx, gy] = gutterCentre(form)
    push(path, lift(form, 'gutter', peel, [gx, gy - KIT_GUTTER.height * 0.15, KIT_FLOW.gutterZ]), shed)
    return
  }
  const last = path.points.at(-1)
  if (last) {
    push(path, offsetBy(last, KIT_FLOW.spill), shed)
  }
}

export interface RotSpot {
  position: RibbonPoint
  /** Turn about the kit's z: the slope's pitch for a part laid on the gable, 0 for a level one. */
  tilt: number
  /** Through a thin part, so the rot shows from the attic too; on a thick one, only its top. */
  thickness: number
}

// Where the rain crosses a soaked part, at the part's resting place (the patch rides with the part as it peels), set back from
// the cut end onto the part itself.
export function rotPatchSpot(form: RoofForm, part: ResolvedPart): RotSpot | null {
  const heights = faceHeights(form, part)
  if (!heights) {
    return null
  }
  const [inner, outer] = heights
  const through = outer - inner <= KIT_ROT.throughMax
  const height = through ? (inner + outer) / 2 : outer
  const thickness = through ? outer - inner + KIT_ROT.lift * 2 : KIT_ROT.lift * 2
  if (form === 'low-slope') {
    return { position: [KIT_FLOW.lowSlopeX, height, KIT_ROT.z], tilt: 0, thickness }
  }
  if (SLOPED_LINE_PARTS.has(part.id)) {
    return { position: frontSlopePoint(KIT_FLOW.pitchedAlong, height, KIT_ROT.z), tilt: PITCHED_KIT.pitch, thickness }
  }
  const [atticX] = frontSlopePoint(KIT_FLOW.pitchedAlong, -PITCHED_KIT.rafterDepth)
  return { position: [atticX, height, KIT_ROT.z], tilt: 0, thickness }
}

// The ribbon draws its rings evenly along the curve's length, so each share is placed by how far along the line it sits. A share
// above zero never draws thinner than a readable thread.
export function ribbonWidths(path: RibbonPath, samples: number): number[] {
  const lengths = [0]
  for (let index = 1; index < path.points.length; index++) {
    lengths.push(lengths[index - 1] + distance(path.points[index - 1], path.points[index]))
  }
  const total = lengths.at(-1) ?? 0
  const metres = (share: number) => share > KIT_FLOW.stopped ? Math.max(share * KIT_FLOW.width, KIT_FLOW.minWidth) : 0
  return Array.from({ length: samples }, (_, sample) => {
    const at = samples > 1 ? total * sample / (samples - 1) : 0
    const found = lengths.findIndex(length => length >= at)
    // Rounding can leave the last sample a hair past the end.
    const index = found < 0 ? lengths.length - 1 : Math.max(1, found)
    const from = lengths[index - 1]
    const span = lengths[index] - from
    const t = span > 0 ? (at - from) / span : 0
    const share = path.widths[index - 1] + (path.widths[index] - path.widths[index - 1]) * Math.min(Math.max(t, 0), 1)
    return metres(Number.isFinite(share) ? share : 0)
  })
}
