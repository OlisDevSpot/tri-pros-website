import type { CutawayCrossing, CutawayRainPath, CutawayRotSpot, CutawaySteps, SystemPartId, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart, WaterFlow } from '@/shared/modules/construction/core/types'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { COVERING_BASE, DOWNSPOUTS, EAVE_RUN, GUTTER_BACK, GUTTER_Y, HOUSE, LOW_SLOPE_DECK_Y, LOW_SLOPE_ROOF_Y, RADIANT_BARRIER_FACES, RAFTER_ORIGIN_Y, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { ATTIC_HEAT_LINE, CUTAWAY_COVERING_RISE, CUTAWAY_FLOW, CUTAWAY_ROT, ROTTING_SYSTEM_PARTS } from '@/features/trade-scenes/constants/look-inside'
import { atticInsulationTop } from '@/features/trade-scenes/lib/attic-insulation-boxes'
import { stepBottom, stepCentre, stepStarts } from '@/features/trade-scenes/lib/step-cut-back'

const { pitch, deckThickness: DECK, underlaymentThickness: UNDERLAYMENT, halfDepth: D, wallThickness: T } = HOUSE

// The parts a flow line crosses, outside in. Every part that changes a flow sits on it; the fittings at the edges and the
// framing the line passes between change nothing, so the line can skip them without the widths jumping.
const LINE_PARTS = ['covering', 'underlayment', 'deck', 'radiant-barrier', 'attic-insulation', 'ceiling'] as const
type LinePart = typeof LINE_PARTS[number]
const FLOOR_PARTS: ReadonlySet<string> = new Set(['attic-insulation', 'ceiling'])
const CEILING_Y = WALL_TOP_Y - HOUSE.ceilingThickness
const MEMBRANE_Y = LOW_SLOPE_DECK_Y + DECK
const GUTTER_OUT = D + GUTTER_BACK + ROOF_TRIM.gutter.size / 2
// Working numbers, set by eye. A flat roof's water gathers this far in from its back parapet, and leaves by its scupper
// this far over the membrane and inside the parapet's face, falling this far down the downspout before it leaves sight.
// On a gable it runs down to this far short of the eave's edge before it goes over. It shows this far under the ceiling
// where it gets through.
const ROOF_BACK = -D + T + 0.1
const SCUPPER = { over: 0.05, inside: 0.04, fall: 0.4 } as const
const EAVE_SHORT = 0.02
const UNDER_CEILING = 0.03
const NORMAL: Vec3 = [0, Math.cos(pitch), Math.sin(pitch)]

// A point on a gable slope: `along` up it from the rafters' line at the wall, `depth` out from the rafters' top, `back` for
// the far slope.
function slopePoint(x: number, along: number, depth: number, back = false): Vec3 {
  const z = D - along * Math.cos(pitch) + depth * Math.sin(pitch)
  return [x, RAFTER_ORIGIN_Y + along * Math.sin(pitch) + depth * Math.cos(pitch), back ? -z : z]
}

const add = (point: Vec3, by: Vec3): Vec3 => [point[0] + by[0], point[1] + by[1], point[2] + by[2]]
const scaled = (by: Vec3, share: number): Vec3 => [by[0] * share, by[1] * share, by[2] * share]

function coveringRise(form: RoofForm, material: string | null): number {
  return form === 'low-slope' ? 0 : CUTAWAY_COVERING_RISE[material ?? ''] ?? CUTAWAY_COVERING_RISE.default
}

// [inner, outer] of each line part: off the rafters' top across a gable's slope, or heights in the house for anything laid
// flat (a flat roof's parts, and the attic floor under either roof). Only a gable has a radiant barrier.
function faces(form: RoofForm, part: ResolvedPart & { id: LinePart }, z: number): readonly [number, number] {
  const lowSlope = form === 'low-slope'
  switch (part.id) {
    case 'ceiling': return [CEILING_Y, WALL_TOP_Y]
    case 'attic-insulation': return [WALL_TOP_Y, atticInsulationTop(part.material, lowSlope, z)]
    case 'radiant-barrier': return RADIANT_BARRIER_FACES
    case 'deck': return lowSlope ? [LOW_SLOPE_DECK_Y, MEMBRANE_Y] : [0, DECK]
    case 'underlayment': return lowSlope ? [MEMBRANE_Y, MEMBRANE_Y + UNDERLAYMENT / 2] : [DECK, DECK + UNDERLAYMENT]
    case 'covering': return lowSlope ? [MEMBRANE_Y + UNDERLAYMENT / 2, LOW_SLOPE_ROOF_Y] : [COVERING_BASE, COVERING_BASE + coveringRise(form, part.material)]
  }
}

function isLinePart(part: ResolvedPart): part is ResolvedPart & { id: LinePart } {
  return (LINE_PARTS as readonly string[]).includes(part.id) && part.material !== null
}

// Where a flow crosses each drawn line part, outside in, at the step it shows. A stepped part is crossed just in front of
// its step's cut end, where it shows its section; a part that stays whole (unstepped, or the bottom step) is crossed below
// the part over it. On a gable the line runs across the near slope's parts and then down through the attic: plumb for
// heat, and for rain over to the leak's spot, where the ceiling tells its story. On a flat roof the heat crosses the roof's
// parts further toward the yard, the higher the further, so its arrows have room. The attic's heat runs on its own line,
// behind the ridge, where the house it holds open still draws the roof and the attic floor: plumb down through the middle
// of the strip the floor's top step shows, so it never crosses a floor part where the steps have cut it back, and the
// parts under the top step lie whole beneath it.
export function cutawayCrossings(form: RoofForm, parts: readonly ResolvedPart[], steps: CutawaySteps, flow: 'rain' | 'heat'): CutawayCrossing[] {
  const lowSlope = form === 'low-slope'
  const attic = flow === 'heat' && steps.system === 'attic'
  const starts = stepStarts(steps.system, steps.shown, steps.peel)
  const bottom = stepBottom(steps.shown)
  const line = LINE_PARTS.flatMap(id => parts.filter(isLinePart).filter(part => part.id === id))
  const ownStart = (id: SystemPartId) => id === bottom ? undefined : starts.get(id)
  const own = line.map(part => ownStart(part.id))
  const first = own.find(x => x !== undefined) ?? HOUSE.cutX
  const xs: number[] = []
  own.forEach((x, index) => xs.push(x ?? (index === 0 ? first : xs[index - 1])))

  const crossings: CutawayCrossing[] = []
  const lowSlopeZ = attic ? ATTIC_HEAT_LINE.lowSlopeZ : CUTAWAY_FLOW.lowSlopeZ
  const floorTop = attic ? line.find(part => FLOOR_PARTS.has(part.id))! : undefined
  const floorX = floorTop && stepCentre('attic', starts.get(floorTop.id) ?? HOUSE.cutX, steps.peel)
  let dropZ: number = lowSlope ? lowSlopeZ : D
  line.forEach((part, index) => {
    const start = own[index]
    const edge = floorX ?? xs[index] - CUTAWAY_FLOW.front
    const treadX = start === undefined || floorX !== undefined ? edge : stepCentre(steps.system, start, steps.peel)
    if (FLOOR_PARTS.has(part.id)) {
      const [x, z] = flow === 'rain' ? [LEAK.spot[0], LEAK.spot[1]] : [edge, dropZ]
      const [inner, outer] = faces(form, part, z)
      const treadAt = flow === 'rain' ? x : treadX
      crossings.push({ partId: part.id, outer: [x, outer, z], inner: [x, inner, z], tread: [treadAt, outer, z] })
      return
    }
    const [inner, outer] = faces(form, part, dropZ)
    if (lowSlope) {
      const above = Math.min(Math.max((outer - LOW_SLOPE_DECK_Y) / (LOW_SLOPE_ROOF_Y - LOW_SLOPE_DECK_Y), 0), 1)
      const z = lowSlopeZ + (flow === 'heat' ? CUTAWAY_FLOW.lowSlopeHeat.out + CUTAWAY_FLOW.lowSlopeHeat.slant * above : 0)
      crossings.push({ partId: part.id, outer: [edge, outer, z], inner: [edge, inner, z], tread: [treadX, outer, z] })
      return
    }
    const toFoil = flow === 'heat' && part.id === 'radiant-barrier' ? (attic ? ATTIC_HEAT_LINE.barrierAlong : CUTAWAY_FLOW.barrierAlong) : 0
    const along = (attic ? ATTIC_HEAT_LINE.along : CUTAWAY_FLOW.pitchedAlong) - toFoil
    const crossing = { partId: part.id, outer: slopePoint(edge, along, outer, attic), inner: slopePoint(edge, along, inner, attic), tread: slopePoint(treadX, along, outer, attic) }
    dropZ = crossing.inner[2]
    crossings.push(crossing)
  })
  return crossings
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const midpoint = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

// A curve through two points at one spot has no direction there, so a point on top of the last one only updates its share.
function push(path: CutawayRainPath, point: Vec3, width: number): void {
  const last = path.points.at(-1)
  if (last && distance(last, point) < 1e-3) {
    path.widths[path.widths.length - 1] = width
    return
  }
  path.points.push([point[0], point[1], point[2]])
  path.widths.push(width)
}

// A part crossed by the flow: its entry face at the share arriving, its exit face at the share leaving; a part too thin to
// show both is one station at its middle with the share leaving.
function crossSpan(path: CutawayRainPath, entry: Vec3, exit: Vec3, entryWidth: number, exitWidth: number): void {
  if (distance(entry, exit) < CUTAWAY_FLOW.faceStationMin) {
    push(path, midpoint(entry, exit), exitWidth)
    return
  }
  push(path, entry, entryWidth)
  push(path, exit, exitWidth)
}

const SHEDS: ReadonlySet<string> = new Set(['surface', 'shed-water'])
const has = (parts: readonly ResolvedPart[], id: string) => parts.some(part => part.id === id && part.material !== null)

// Down the shedding part's step to the eave, over the drip edge (when there is one) and into the gutter, or off the roof
// without one. A flat roof sheds to its back parapet and out through the scupper nearest the line. `outer` is the shedding
// part's outer face: off the rafters' top on a gable, its height on a flat roof.
function shedRun(path: CutawayRainPath, form: RoofForm, parts: readonly ResolvedPart[], landing: Vec3, outer: number, shed: number): void {
  if (form === 'pitched') {
    const over = scaled(NORMAL, CUTAWAY_FLOW.sheetOver)
    const eaveAlong = -EAVE_RUN + EAVE_SHORT
    push(path, add(slopePoint(landing[0], (CUTAWAY_FLOW.pitchedAlong + eaveAlong) / 2, outer), over), shed)
    push(path, add(slopePoint(landing[0], eaveAlong, outer), over), shed)
    if (has(parts, 'drip-edge')) {
      push(path, add(slopePoint(landing[0], -EAVE_RUN, COVERING_BASE), CUTAWAY_FLOW.offEdge), shed)
    }
    if (has(parts, 'gutter')) {
      push(path, [landing[0], GUTTER_Y, GUTTER_OUT], shed)
      return
    }
  }
  else {
    const y = outer + CUTAWAY_FLOW.sheetOver
    push(path, [landing[0], y, ROOF_BACK], shed)
    if (has(parts, 'gutter')) {
      const [x, z] = DOWNSPOUTS.lowSlope.at.reduce((best, at) => Math.abs(at[0] - landing[0]) < Math.abs(best[0] - landing[0]) ? at : best)
      push(path, [x, y, ROOF_BACK], shed)
      push(path, [x, MEMBRANE_Y + SCUPPER.over, -D + T / 2 - SCUPPER.inside], shed)
      push(path, [x, MEMBRANE_Y - SCUPPER.fall, z], shed)
      return
    }
  }
  push(path, add(path.points.at(-1)!, CUTAWAY_FLOW.spill), shed)
}

// The rain walks down from the sky onto the top step and through each part, thinning where a worn part soaks it up. A sound
// shedding part stops it: from its step it runs down to the gutter. What gets past the roof drops through the attic to
// the leak's spot and, when any reaches inside, on through the ceiling, where the drip forms.
export function cutawayRainPath(form: RoofForm, parts: readonly ResolvedPart[], water: WaterFlow, steps: CutawaySteps): CutawayRainPath {
  const crossings = cutawayCrossings(form, parts, steps, 'rain')
  const path: CutawayRainPath = { points: [], widths: [], drip: false }
  push(path, add(crossings[0].tread, CUTAWAY_FLOW.sky[form]), water.boundaries[0])

  for (const [index, crossing] of crossings.entries()) {
    const part = parts.filter(isLinePart).find(candidate => candidate.id === crossing.partId)!
    const level = water.parts[crossing.partId]
    if (!level) {
      continue
    }
    if (SHEDS.has(part.role) && level.outer > CUTAWAY_FLOW.stopped && level.inner <= CUTAWAY_FLOW.stopped) {
      push(path, crossing.tread, level.outer)
      shedRun(path, form, parts, crossing.tread, faces(form, part, crossing.tread[2])[1], water.shed)
      return path
    }
    if (index === 0) {
      push(path, crossing.tread, level.outer)
    }
    crossSpan(path, crossing.outer, crossing.inner, level.outer, level.inner)
    if (level.inner <= CUTAWAY_FLOW.stopped) {
      return path
    }
  }

  const ceiling = crossings.at(-1)!
  push(path, [ceiling.inner[0], ceiling.inner[1] - UNDER_CEILING, ceiling.inner[2]], water.reachesInside)
  path.drip = water.reachesInside > CUTAWAY_FLOW.stopped
  return path
}

const ROTTING: ReadonlySet<string> = new Set(ROTTING_SYSTEM_PARTS)

// A dark stain where the rain crosses each wood part it soaks, on that part's step, wider the more it soaks: right through
// a thin part, so it shows from the attic too, or on a thick one's top.
export function cutawayRotSpots(form: RoofForm, parts: readonly ResolvedPart[], water: WaterFlow, steps: CutawaySteps): CutawayRotSpot[] {
  return cutawayCrossings(form, parts, steps, 'rain').flatMap((crossing) => {
    const soaked = water.soaked[crossing.partId] ?? 0
    if (!ROTTING.has(crossing.partId) || soaked <= 0) {
      return []
    }
    const thickness = distance(crossing.outer, crossing.inner)
    const through = thickness <= CUTAWAY_ROT.throughMax
    // Set back from the step's cut end onto the part itself.
    const radius = CUTAWAY_ROT.radius * soaked
    const x = Math.max(crossing.tread[0], crossing.outer[0] + CUTAWAY_FLOW.front + radius)
    const centre = through ? midpoint(crossing.outer, crossing.inner) : crossing.outer
    // Toward the eave on a gable, toward the front on a flat roof.
    const aside: Vec3 = form === 'pitched' ? [0, -Math.sin(pitch) * CUTAWAY_ROT.aside, Math.cos(pitch) * CUTAWAY_ROT.aside] : [0, 0, CUTAWAY_ROT.aside]
    return [{
      partId: crossing.partId,
      position: [x, centre[1] + aside[1], centre[2] + aside[2]],
      tilt: form === 'pitched' ? pitch : 0,
      thickness: through ? thickness + CUTAWAY_ROT.lift * 2 : CUTAWAY_ROT.lift * 2,
      size: [radius * 2, radius * 2],
    }]
  })
}

// The ribbon draws its rings evenly along the curve's length, so each share is placed by how far along the line it sits. A
// share above zero never draws thinner than a readable thread.
export function cutawayRibbonWidths(path: CutawayRainPath, samples: number): number[] {
  const lengths = [0]
  for (let index = 1; index < path.points.length; index++) {
    lengths.push(lengths[index - 1] + distance(path.points[index - 1], path.points[index]))
  }
  const total = lengths.at(-1)!
  const metres = (share: number) => share > CUTAWAY_FLOW.stopped ? Math.max(share * CUTAWAY_FLOW.width, CUTAWAY_FLOW.minWidth) : 0
  return Array.from({ length: samples }, (_, sample) => {
    const at = samples > 1 ? total * sample / (samples - 1) : 0
    const found = lengths.findIndex(length => length >= at)
    // Rounding can leave the last sample a hair past the end.
    const index = found < 0 ? lengths.length - 1 : Math.max(1, found)
    const from = lengths[index - 1]
    const span = lengths[index] - from
    const t = span > 0 ? (at - from) / span : 0
    const share = path.widths[index - 1] + (path.widths[index] - path.widths[index - 1]) * Math.min(Math.max(t, 0), 1)
    return metres(share)
  })
}
