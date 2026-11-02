import type { BoxSpec } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { ATTIC_EAVE_INSULATION, ATTIC_JOIST_XS, HOUSE, LOW_SLOPE, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { laidInsulationDepth } from '@/features/trade-scenes/lib/laid-insulation-depth'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'

interface Band {
  from: number
  to: number
  top: number
}

const { halfLength: L, halfDepth: D, wallThickness: T, joistWidth } = HOUSE
const EDGE = D - T
const { clearance, steps } = ATTIC_EAVE_INSULATION

export function atticJoistDepth(lowSlope: boolean): number {
  return lowSlope ? LOW_SLOPE.joistSpace : HOUSE.joistDepth
}

function formOf(lowSlope: boolean): RoofForm {
  return lowSlope ? 'low-slope' : 'pitched'
}

function headroom(across: number, form: RoofForm): number {
  return roofUndersideY(across, form) - WALL_TOP_Y - clearance
}

// How high the blanket lies across one side of the house, from the middle out to the wall, as runs of distance from the
// ridge line. Laid full depth under a pitched roof's eaves it would rise through the roof, so there it steps down, each band
// as deep as the roof clears at its outer edge, the way blown fill thins out under the eaves.
function insulationBands(depth: number, form: RoofForm): Band[] {
  if (headroom(EDGE, form) >= depth) {
    return [{ from: 0, to: EDGE, top: depth }]
  }
  // Only a pitched roof comes down toward the walls.
  const reach = Math.max(0, D - (depth + clearance - HOUSE.heel) / Math.tan(HOUSE.pitch))
  const step = (EDGE - reach) / steps
  const eave = Array.from({ length: steps }, (_, index): Band => {
    const to = reach + step * (index + 1)
    return { from: reach + step * index, to, top: Math.min(depth, headroom(to, form)) }
  })
  return reach > 0 ? [{ from: 0, to: reach, top: depth }, ...eave] : eave
}

function bandAt(bands: readonly Band[], z: number): Band {
  return bands.find(band => Math.abs(z) <= band.to) ?? bands[bands.length - 1]
}

const overJoists = (top: number, joistDepth: number) => top - joistDepth > 0.01

// Batts sit between the joists, so a thin blanket leaves the joist tops showing, which is the tell of an under-insulated
// attic; anything deeper than the joists runs on over them. Blown insulation is one even blanket. `span` lies on one side
// of the ridge line.
export function atticInsulationBoxes(material: string, lowSlope: boolean, span: { from: number, to: number }): BoxSpec[] {
  const form = formOf(lowSlope)
  const depth = laidInsulationDepth(material, lowSlope)
  const joistDepth = atticJoistDepth(lowSlope)
  const bands = insulationBands(depth, form)
  const side = span.from + span.to < 0 ? -1 : 1
  const across = (band: Band) => ({ run: band.to - band.from, centre: (side * (band.from + band.to)) / 2 })
  const sheet = (band: Band, bottom: number): BoxSpec => {
    const { run, centre } = across(band)
    return { size: [L * 2 - T * 2, band.top - bottom, run], position: [0, WALL_TOP_Y + (bottom + band.top) / 2, centre] }
  }
  if (material.startsWith('blown')) {
    return bands.map(band => sheet(band, 0))
  }
  const between = Math.min(depth, joistDepth, ...bands.map(band => band.top))
  const run = span.to - span.from
  const centre = (span.from + span.to) / 2
  const bays = ATTIC_JOIST_XS.slice(1).map((x, index): BoxSpec => {
    const from = ATTIC_JOIST_XS[index] + joistWidth / 2
    const to = x - joistWidth / 2
    return { size: [to - from - 0.01, between, run], position: [(from + to) / 2, WALL_TOP_Y + between / 2, centre] }
  })
  return [...bays, ...bands.filter(band => overJoists(band.top, joistDepth)).map(band => sheet(band, joistDepth))]
}

// The blanket's top over a point `z` across the house, where water soaking down through it shows.
export function atticInsulationTop(material: string | null, lowSlope: boolean, z: number): number {
  if (material === null) {
    return WALL_TOP_Y
  }
  const depth = laidInsulationDepth(material, lowSlope)
  const joistDepth = atticJoistDepth(lowSlope)
  const bands = insulationBands(depth, formOf(lowSlope))
  const { top } = bandAt(bands, z)
  if (material.startsWith('blown') || overJoists(top, joistDepth)) {
    return WALL_TOP_Y + top
  }
  return WALL_TOP_Y + Math.min(depth, joistDepth, ...bands.map(band => band.top))
}
