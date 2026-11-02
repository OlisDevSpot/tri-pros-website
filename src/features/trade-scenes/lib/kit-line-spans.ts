import type { LineSpan, RibbonPoint } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { KIT_COVERING_RISE, KIT_FLOW } from '@/features/trade-scenes/constants/roof-attic-flows'
import {
  KIT_INSULATION_DEPTH,
  KIT_PEEL,
  LOW_SLOPE_COVERING_BASE,
  LOW_SLOPE_KIT,
  PITCHED_COVERING_BASE,
  PITCHED_KIT,
} from '@/features/trade-scenes/constants/roof-attic-kit'
import { frontSlopePoint } from '@/features/trade-scenes/lib/roof-attic-kit-points'

// The parts the flow line crosses, inside → out. Every part that changes a flow sits on it; the fittings at the edges and the
// framing the line passes between change nothing, so the line can skip them without the widths jumping.
const LINE_PARTS = ['ceiling', 'attic-insulation', 'radiant-barrier', 'deck', 'underlayment', 'covering'] as const

// A point on a part, carried where the peel has lifted that part.
export function lift(form: RoofForm, partId: string, peel: number, point: readonly [number, number, number]): RibbonPoint {
  const [dx, dy, dz] = KIT_PEEL[form][partId] ?? [0, 0, 0]
  return [point[0] + dx * peel, point[1] + dy * peel, point[2] + dz * peel]
}

export const offsetBy = (point: readonly [number, number, number], by: readonly [number, number]): RibbonPoint => [point[0] + by[0], point[1] + by[1], point[2]]

function insulationDepth(form: RoofForm, material: string | null): number {
  const laid = KIT_INSULATION_DEPTH[material ?? ''] ?? 0
  return form === 'low-slope' ? Math.min(laid, LOW_SLOPE_KIT.joistDepth - 0.01) : laid
}

function coveringRise(form: RoofForm, material: string | null): number {
  return form === 'low-slope' ? LOW_SLOPE_KIT.capSheet : KIT_COVERING_RISE[material ?? ''] ?? KIT_COVERING_RISE.default
}

// [inner, outer] heights of each line part off the rafters' top (gable, across the slope) or the ceiling's top (flat roof).
export function faceHeights(form: RoofForm, part: ResolvedPart): readonly [number, number] | null {
  const pitched = form === 'pitched'
  const kit = pitched ? PITCHED_KIT : LOW_SLOPE_KIT
  const base = pitched ? 0 : LOW_SLOPE_KIT.joistDepth
  switch (part.id) {
    case 'ceiling': return [-kit.drywall, 0]
    case 'attic-insulation': return [0, insulationDepth(form, part.material)]
    case 'radiant-barrier': return pitched ? [-PITCHED_KIT.rafterDepth - kit.foil, -PITCHED_KIT.rafterDepth] : [base - kit.foil, base]
    case 'deck': return [base, base + kit.deck]
    case 'underlayment': return [base + kit.deck + kit.membrane, base + kit.deck + kit.membrane * 2]
    case 'covering': {
      const under = pitched ? PITCHED_COVERING_BASE : LOW_SLOPE_COVERING_BASE
      return [under, under + coveringRise(form, part.material)]
    }
    default: return null
  }
}

// Unit directions in the kit's x/y: down the roof toward its eave, and out of the roof's underside toward its top.
export function roofAxes(form: RoofForm): { towardEave: readonly [number, number], up: readonly [number, number] } {
  const pitch = form === 'pitched' ? PITCHED_KIT.pitch : 0
  return { towardEave: [-Math.cos(pitch), -Math.sin(pitch)], up: [-Math.sin(pitch), Math.cos(pitch)] }
}

export const SLOPED_LINE_PARTS: ReadonlySet<string> = new Set(['radiant-barrier', 'deck', 'underlayment', 'covering'])

// Where the line crosses each drawn part at this peel. On a gable it runs across the front slope's parts, then straight down
// through the attic below where it left them; on a flat roof it is one plumb line.
export function lineSpans(form: RoofForm, parts: readonly ResolvedPart[], peel: number): LineSpan[] {
  const z = KIT_FLOW.z
  const [atticX] = frontSlopePoint(KIT_FLOW.pitchedAlong, -PITCHED_KIT.rafterDepth)
  const spans: LineSpan[] = []
  for (const id of LINE_PARTS) {
    const part = parts.find(candidate => candidate.id === id && candidate.material !== null)
    const heights = part && faceHeights(form, part)
    if (!part || !heights) {
      continue
    }
    const at = (height: number): RibbonPoint => {
      if (form === 'low-slope') {
        return [KIT_FLOW.lowSlopeX, height, z]
      }
      return SLOPED_LINE_PARTS.has(id) ? frontSlopePoint(KIT_FLOW.pitchedAlong, height, z) : [atticX, height, z]
    }
    spans.push({ partId: id, inner: lift(form, id, peel, at(heights[0])), outer: lift(form, id, peel, at(heights[1])) })
  }
  return spans
}
