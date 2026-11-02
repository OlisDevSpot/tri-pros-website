import type { ArrowLane, HomeHeat, LineSpan, RibbonPoint, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart, Season } from '@/shared/modules/construction/core/types'

import { KIT_FLOW } from '@/features/trade-scenes/constants/roof-attic-flows'
import { KIT_PEEL, LOW_SLOPE_KIT, LOW_SLOPE_ROOF_TOP } from '@/features/trade-scenes/constants/roof-attic-kit'
import { bounceArrowLane, heatArrowLane } from '@/features/trade-scenes/lib/heat-arrow-lane'
import { heatLaneFlows } from '@/features/trade-scenes/lib/heat-lane-flows'
import { lineSpans, offsetBy, roofAxes } from '@/features/trade-scenes/lib/kit-line-spans'

const ATTIC_FLOOR_PARTS = new Set(['ceiling', 'attic-insulation'])
const BARRIER = 'radiant-barrier'

// Where the heat crosses each part: the flow line, except that it meets the gable's barrier further down the slope, and a
// flat roof's barrier further out and the layers above it further out again the higher they sit, so the heat slants down
// through them. The flat roof's slant is set by each face's height at rest, so a peel carries the faces straight up without
// bending it.
export function kitHeatSpans(form: RoofForm, parts: readonly ResolvedPart[], peel: number): LineSpan[] {
  const spans = lineSpans(form, parts, peel)
  if (form === 'pitched') {
    const { towardEave } = roofAxes(form)
    const down = (point: RibbonPoint) => offsetBy(point, [towardEave[0] * KIT_FLOW.pitchedBarrierAlong, towardEave[1] * KIT_FLOW.pitchedBarrierAlong])
    return spans.map(span => span.partId === BARRIER ? { ...span, inner: down(span.inner), outer: down(span.outer) } : span)
  }
  const out = KIT_FLOW.lowSlopeHeatX - KIT_FLOW.lowSlopeX
  const roofThickness = LOW_SLOPE_ROOF_TOP - LOW_SLOPE_KIT.joistDepth
  const across = (partId: string, point: RibbonPoint): RibbonPoint => {
    const restY = point[1] - (KIT_PEEL[form][partId]?.[1] ?? 0) * peel
    const above = partId === BARRIER ? 0 : Math.min(Math.max((restY - LOW_SLOPE_KIT.joistDepth) / roofThickness, 0), 1)
    return [point[0] + out + KIT_FLOW.lowSlopeCoveringSlant * above, point[1], point[2]]
  }
  return spans.map(span => ATTIC_FLOOR_PARTS.has(span.partId) ? span : { ...span, inner: across(span.partId, span.inner), outer: across(span.partId, span.outer) })
}

// Where the radiant barrier sends the heat it turns back: from its underside, down the roof and up toward the deck.
export function kitBarrierBounceEnd(form: RoofForm, barrier: LineSpan): Vec3 {
  const { towardEave, up } = roofAxes(form)
  const [along, rise] = KIT_FLOW.barrierBounce[form]
  return offsetBy(barrier.inner, [towardEave[0] * along + up[0] * rise, towardEave[1] * along + up[1] * rise])
}

// Two stations at one spot leave the arrow there with no direction to face.
function withoutRepeats(points: readonly Vec3[]): Vec3[] {
  return points.filter((point, index) => index === 0 || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1], point[2] - points[index - 1][2]) >= 1e-3)
}

// The section's lanes for the home's heat, held at the same points as the whole home's roof so the counts above and below
// each layer agree with it: onto the covering, through the roof's layers to the radiant barrier when there is one, past it
// to the top of the attic floor, and through that floor into the room. Each lane crosses the parts' faces where they sit at
// this peel, so the arrows ride the layers apart. Winter's heat leaves the room the same way out, and with no sun nothing
// bounces.
export function kitHeatLanes(form: RoofForm, parts: readonly ResolvedPart[], heat: HomeHeat, season: Season, peel: number): ArrowLane[] {
  const spans = kitHeatSpans(form, parts, peel)
  const covering = spans.find(span => span.partId === 'covering') ?? spans.at(-1)
  const ceiling = spans.find(span => span.partId === 'ceiling') ?? spans[0]
  if (!covering || !ceiling) {
    return []
  }
  const insulation = spans.find(span => span.partId === 'attic-insulation')
  const barrier = spans.find(span => span.partId === BARRIER)
  const atticTop = (insulation ?? ceiling).outer
  const room: Vec3 = [ceiling.inner[0], ceiling.inner[1] - KIT_FLOW.room, ceiling.inner[2]]
  const faces = (keep: (span: LineSpan) => boolean) => spans.filter(keep).reverse().flatMap(span => [span.outer, span.inner])
  const aboveBarrier = faces(span => !ATTIC_FLOOR_PARTS.has(span.partId) && span.partId !== BARRIER)

  const flows = heatLaneFlows(heat)
  const sky: readonly Vec3[] = [offsetBy(covering.outer, KIT_FLOW.sky[form]), covering.outer]
  const toRoom = withoutRepeats([atticTop, ceiling.inner, room])
  const summer = season === 'summer'
  // Listed outside in, each with the flow it carries counted from the heat's source, so winter, which starts in the room,
  // takes them in the other order. Winter's heat meets the insulation before the barrier and has no sun for the barrier to
  // turn back, so it thins at the attic floor and crosses the barrier unchanged, as the whole home's roof lanes do.
  const legs = barrier
    ? [sky, withoutRepeats([...aboveBarrier, barrier.outer]), withoutRepeats([barrier.inner, atticTop]), toRoom]
    : [sky, withoutRepeats([...aboveBarrier, atticTop]), toRoom]
  const fromSource = !barrier
    ? [...flows.roof]
    : summer
      ? [flows.roof[0], flows.pastCovering, flows.roof[1], flows.roof[2]]
      : [flows.roof[0], flows.roof[1], flows.roof[1], flows.roof[2]]
  const ordered = summer ? legs : legs.map(leg => [...leg].reverse()).reverse()
  const lanes = ordered.map((points, leg) => heatArrowLane(points, fromSource[leg]))

  if (summer) {
    const coveringBounce = bounceArrowLane([covering.outer, offsetBy(covering.outer, KIT_FLOW.reflected[form])], flows.coveringBounce)
    const barrierBounce = barrier ? bounceArrowLane([barrier.inner, kitBarrierBounceEnd(form, barrier)], flows.barrierBounce) : null
    for (const lane of [coveringBounce, barrierBounce]) {
      if (lane !== null) {
        lanes.push(lane)
      }
    }
  }
  return lanes.filter(lane => lane.count > 0)
}
