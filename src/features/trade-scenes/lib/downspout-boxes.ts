import type { BoxSpec } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { DOWNSPOUTS, GUTTER_Y, HOME_FLOOR_Y, HOUSE, LOW_SLOPE_DECK_Y } from '@/features/trade-scenes/constants/home-geometry'

// The house is drawn at one floor height and lifted to its foundation's, so a downspout runs down as far as a raised floor
// lifts it to reach the lawn; on a slab the extra length sits under the lawn.
const BOTTOM = -(HOME_FLOOR_Y.raised - HOUSE.floorY)
const MEMBRANE_Y = LOW_SLOPE_DECK_Y + HOUSE.deckThickness
const { halfDepth: D, wallThickness: T } = HOUSE

function downspout(x: number, z: number, size: number, top: number): BoxSpec {
  return { size: [size, top - BOTTOM, size], position: [x, (top + BOTTOM) / 2, z] }
}

// A gable's downspouts drop from its gutters; a flat roof's from a scupper through the back parapet.
export function downspoutBoxes(form: RoofForm): BoxSpec[] {
  if (form === 'pitched') {
    const { size, at } = DOWNSPOUTS.pitched
    return at.map(([x, z]) => downspout(x, z, size, GUTTER_Y))
  }
  const { size, at } = DOWNSPOUTS.lowSlope
  return at.flatMap(([x, z]) => [
    { size: [0.24, 0.12, T + 0.16], position: [x, MEMBRANE_Y + 0.08, -D + T / 2 - 0.04] } satisfies BoxSpec,
    downspout(x, z, size, MEMBRANE_Y),
  ])
}
