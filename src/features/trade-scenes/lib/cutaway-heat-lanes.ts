import type { SectionReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { ArrowLane, CeilingOpening, CutawayCrossing, CutawaySteps, HomeHeat, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart, Season } from '@/shared/modules/construction/core/types'

import { HOUSE, LOW_SLOPE, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { ATTIC_FAN_LANE, CEILING_LEAK_LANE } from '@/features/trade-scenes/constants/home-heat-lanes'
import { CUTAWAY_FLOW, CUTAWAY_READINGS } from '@/features/trade-scenes/constants/look-inside'
import { cutawayCrossings } from '@/features/trade-scenes/lib/cutaway-rain-path'
import { bounceArrowLane, heatArrowLane } from '@/features/trade-scenes/lib/heat-arrow-lane'
import { heatLaneFlows } from '@/features/trade-scenes/lib/heat-lane-flows'

const FLOOR_PARTS: ReadonlySet<string> = new Set(['attic-insulation', 'ceiling'])
const BARRIER = 'radiant-barrier'
const { pitch } = HOUSE
// Unit directions in the house: down the near slope toward its eave, and out of the slope's underside toward its top.
const TOWARD_EAVE: Vec3 = [0, -Math.sin(pitch), Math.cos(pitch)]
const OUT_OF_SLOPE: Vec3 = [0, Math.cos(pitch), Math.sin(pitch)]
// The fan draws the attic's air this far along the attic to its gable vent. A working number.
const FAN_DRAW = 1

const add = (point: Vec3, by: Vec3): Vec3 => [point[0] + by[0], point[1] + by[1], point[2] + by[2]]

// A crossing behind the ridge is on the back slope, which faces the other way.
const slopeSide = (point: Vec3) => point[2] < 0 ? -1 : 1

// Where the foil sends the heat it turns back: from its underside toward the eave and up into the rafter bay, under the deck.
export function cutawayBarrierBounceEnd(barrier: CutawayCrossing): Vec3 {
  const [along, up] = CUTAWAY_FLOW.barrierBounce
  const side = slopeSide(barrier.inner)
  return add(barrier.inner, [0, TOWARD_EAVE[1] * along + OUT_OF_SLOPE[1] * up, side * (TOWARD_EAVE[2] * along + OUT_OF_SLOPE[2] * up)])
}

// Two stations at one spot leave the arrow there with no direction to face.
function withoutRepeats(points: readonly Vec3[]): Vec3[] {
  return points.filter((point, index) => index === 0 || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1], point[2] - points[index - 1][2]) >= 1e-3)
}

// The steps' lanes for the home's heat, counted from the same table as the whole home's roof so the arrows above and below
// each part agree with it: onto the top step, down the steps through the roof's parts to the radiant barrier when there is
// one, past it to the top of the attic floor, and through that floor into the room. Each lane crosses the parts at their
// steps as the peel opens them, so the arrows ride the steps apart. Winter's heat leaves the room the same way out, and
// with no sun nothing bounces. A running attic fan sends its share out through the gable vent. The attic's flow is the
// same table from where the roof's ends, under the deck: the covering's steps and the sun on them are the roof's, and each
// of `leaks`, the ceiling openings air sealing has not closed, lets a thin lane of attic air through its gap.
export function cutawayHeatLanes(form: RoofForm, parts: readonly ResolvedPart[], heat: HomeHeat, season: Season, steps: CutawaySteps, leaks: readonly CeilingOpening[]): ArrowLane[] {
  const spans = cutawayCrossings(form, parts, steps, 'heat')
  const attic = steps.system === 'attic'
  const covering = spans.find(span => span.partId === 'covering')!
  const deck = spans.find(span => span.partId === 'deck')!
  const ceiling = spans.find(span => span.partId === 'ceiling')!
  const insulation = spans.find(span => span.partId === 'attic-insulation')
  const barrier = spans.find(span => span.partId === BARRIER)
  const atticTop = (insulation ?? ceiling).outer
  const room: Vec3 = [ceiling.inner[0], ceiling.inner[1] - CUTAWAY_FLOW.room, ceiling.inner[2]]
  const aboveBarrier = spans.filter(span => !FLOOR_PARTS.has(span.partId) && span.partId !== BARRIER).flatMap(span => [span.outer, span.inner])

  const flows = heatLaneFlows(heat)
  const sky: readonly Vec3[] = [add(covering.tread, CUTAWAY_FLOW.sky[form]), covering.tread]
  const toRoom = withoutRepeats([atticTop, ceiling.inner, room])
  const summer = season === 'summer'
  // Listed outside in, each with the flow it carries counted from the heat's source, so winter, which starts in the room,
  // takes them in the other order. Winter's heat meets the insulation before the barrier and has no sun for the barrier to
  // turn back, so it thins at the attic floor and crosses the barrier unchanged, as the whole home's roof lanes do.
  const intoAttic = attic ? [deck.inner] : [covering.tread, ...aboveBarrier]
  const legs = barrier
    ? [sky, withoutRepeats([...intoAttic, barrier.outer]), withoutRepeats([barrier.inner, atticTop]), toRoom]
    : [sky, withoutRepeats([...intoAttic, atticTop]), toRoom]
  const fromSource = !barrier
    ? [...flows.roof]
    : summer
      ? [flows.roof[0], flows.pastCovering, flows.roof[1], flows.roof[2]]
      : [flows.roof[0], flows.roof[1], flows.roof[1], flows.roof[2]]
  // The attic drops the sky's leg, the first from the source in summer and the last in winter.
  const own = attic ? legs.slice(1) : legs
  const figures = !attic ? fromSource : summer ? fromSource.slice(1) : fromSource.slice(0, -1)
  const ordered = summer ? own : own.map(leg => [...leg].reverse()).reverse()
  const lanes = ordered.map((points, leg) => heatArrowLane(points, figures[leg]))

  if (summer) {
    const coveringBounce = attic ? null : bounceArrowLane([covering.tread, add(covering.tread, CUTAWAY_FLOW.reflected[form])], flows.coveringBounce)
    const barrierBounce = barrier ? bounceArrowLane([barrier.inner, cutawayBarrierBounceEnd(barrier)], flows.barrierBounce) : null
    for (const lane of [coveringBounce, barrierBounce]) {
      if (lane !== null) {
        lanes.push(lane)
      }
    }
  }
  // Never reversed: a fan only ever blows out, whatever the season.
  if (heat.atticFanRunning) {
    const { vent, outside } = ATTIC_FAN_LANE
    lanes.push(heatArrowLane([[vent[0] + FAN_DRAW, vent[1], vent[2]], vent, outside], flows.roof[1]))
  }
  // The gaps are in the ceiling, under the blanket, so they leak whatever the insulation; a flat roof has no attic over them.
  for (const { at: [x, z] } of form === 'pitched' ? leaks : []) {
    const gap: Vec3[] = [[x, WALL_TOP_Y + CEILING_LEAK_LANE.above, z], [x, WALL_TOP_Y - CEILING_LEAK_LANE.below, z]]
    lanes.push(heatArrowLane(summer ? gap : gap.reverse(), CEILING_LEAK_LANE.flow))
  }
  return lanes.filter(lane => lane.count > 0)
}

// Where the three readings pin on the steps: the roof's on the covering, the attic's in the air under it, the ceiling's
// on the ceiling. They follow the line the heat crosses, so they ride the steps as they open. The attic's stand on its own
// line, on the span the house it holds open keeps: the roof's and the attic's beside the line, clear of the card, the
// ceiling's behind the kept cut edge.
export function cutawayReadingSpots(form: RoofForm, parts: readonly ResolvedPart[], steps: CutawaySteps): Record<SectionReadingId, Vec3> {
  const spans = cutawayCrossings(form, parts, steps, 'heat')
  const covering = spans.find(span => span.partId === 'covering')!
  const ceiling = spans.find(span => span.partId === 'ceiling')!
  const { onCovering, pitched, lowSlope, ceilingBelow, ceilingFromFront, attic } = CUTAWAY_READINGS
  const own = steps.system === 'attic'
  const ceilingSpot: Vec3 = [ceiling.inner[0], ceiling.inner[1] - ceilingBelow, own ? HOUSE.atticFrontZ - attic.ceilingBack : HOUSE.halfDepth - ceilingFromFront]
  const aside = own ? attic.aside : 0
  if (form === 'low-slope') {
    return {
      roof: [covering.tread[0] + onCovering, covering.tread[1], covering.tread[2] - lowSlope.roofBack],
      attic: [ceiling.outer[0] - aside, WALL_TOP_Y + LOW_SLOPE.joistSpace * lowSlope.atticShare, ceiling.outer[2] + lowSlope.atticFront],
      ceiling: ceilingSpot,
    }
  }
  const side = slopeSide(covering.tread)
  const up: Vec3 = [own ? -aside : onCovering, -TOWARD_EAVE[1] * pitched.roofAlong + OUT_OF_SLOPE[1] * pitched.over, side * (-TOWARD_EAVE[2] * pitched.roofAlong + OUT_OF_SLOPE[2] * pitched.over)]
  return {
    roof: add(covering.tread, up),
    attic: [ceiling.outer[0] - aside, WALL_TOP_Y + pitched.atticRise, own ? ceiling.outer[2] : ceiling.outer[2] - pitched.atticBack],
    ceiling: ceilingSpot,
  }
}
