import type { GutterWetSpans } from '@/features/trade-scenes/types'
import type { RainColumn } from '@/shared/components/scene/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { GUTTER_OUT, GUTTER_Y, HOUSE, LOWEST_LAWN_Y, ROOF_HALF_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { GUTTER_WATER } from '@/features/trade-scenes/constants/home-life'
import { downspoutOutlet, drainingDownspouts } from '@/features/trade-scenes/lib/downspout-boxes'
import { EAVE_DRIP } from '@/features/trade-scenes/lib/eave-drip'
import { groundTopAlong } from '@/features/trade-scenes/lib/ground-top-along'
import { gutterDropAt, gutterRunSpans } from '@/features/trade-scenes/lib/gutter-run'

interface Water { kept: RainColumn[], complete: RainColumn[] }

const R = ROOF_HALF_LENGTH
const { curtain: CURTAIN, outlet: OUTLET, trickle: TRICKLE } = GUTTER_WATER
const { outline: OUTLINE } = ROOF_TRIM.gutter.profile
const GUTTER_BOTTOM_UP = Math.min(...OUTLINE.map(([, up]) => up))
const FRONT_LIP = GUTTER_OUT + Math.max(...OUTLINE.map(([out]) => out))
const none = (): Water => ({ kept: [], complete: [] })
// One list for every home whose walls stay dry, so a weather toggle on a sound gutter hands the walls the same spans and
// their stain lists are not rebuilt.
const DRY: GutterWetSpans = { front: [], back: [] }

// Down to the house frame's lawn on a raised floor, so the water reaches the ground whatever the foundation; on a slab the
// rest falls out of sight under the lawn.
function fallingFrom(top: number, x: number, width: number, z: number, depth: number, streaks: number): RainColumn {
  return { box: [width, top - LOWEST_LAWN_Y, depth], position: [x, (top + LOWEST_LAWN_Y) / 2, z], streaks }
}

function curtain([from, to]: readonly [number, number], side: 1 | -1): RainColumn {
  return fallingFrom(EAVE_DRIP.y, (from + to) / 2, to - from, side * EAVE_DRIP.out, CURTAIN.depth, Math.round((to - from) * CURTAIN.perMetre))
}

// House frame. Where nothing catches the roof's water it leaves the eave: everywhere with no gutter, and at Failing off the
// pulled end. A sag pools and trickles over the front lip at its low point. A flat roof sheds inside its parapets to the
// scuppers, so no eave drips whatever its gutter.
export function gutterWater(wear: Wear | null, form: RoofForm): Water {
  if (form !== 'pitched') {
    return none()
  }
  if (wear === null) {
    return { kept: [curtain([HOUSE.cutX, R], 1), curtain([-R, R], -1)], complete: [curtain([-R, HOUSE.cutX], 1)] }
  }
  const { sagLow, pulled } = gutterRunSpans(wear)
  if (sagLow === null) {
    return none()
  }
  const sagBottom = GUTTER_Y - gutterDropAt(wear, 'front', sagLow) + GUTTER_BOTTOM_UP
  const trickle = fallingFrom(sagBottom, sagLow, TRICKLE.width, FRONT_LIP, TRICKLE.width, TRICKLE.streaks)
  return { kept: pulled === null ? [trickle] : [trickle, curtain(pulled, 1)], complete: [] }
}

// House frame. Where the roof's water leaves the eave onto the wall's foot while it rains: the whole front and back with no
// gutter, and the pulled span at Failing. It is the extent of the eave curtain, and a flat roof has none.
export function gutterWetSpans(wear: Wear | null, form: RoofForm, raining: boolean): GutterWetSpans {
  if (!raining || form !== 'pitched') {
    return DRY
  }
  if (wear === null) {
    return { front: [[-R, R]], back: [[-R, R]] }
  }
  const { pulled } = gutterRunSpans(wear)
  return pulled === null ? DRY : { front: [pulled], back: [] }
}

// World frame: water out of each extension that still drains. The open end rests on the ground, so the water runs out of it
// along the lawn or a bed's mulch, away from the house, over the highest of them.
export function gutterOutlets(wear: Wear | null, form: RoofForm): Water {
  if (wear === null) {
    return none()
  }
  const outlet = (at: readonly [number, number]): RainColumn => {
    const [x, , z] = downspoutOutlet(at)
    const away = Math.sign(z)
    const run = OUTLET.box[2]
    return {
      box: OUTLET.box,
      position: [x, groundTopAlong(x, z, z + away * run) + OUTLET.lift, z + away * run / 2],
      streaks: OUTLET.streaks,
      flow: [0, 0, away],
    }
  }
  const { kept, complete } = drainingDownspouts(form, wear)
  return { kept: kept.map(outlet), complete: complete.map(outlet) }
}
