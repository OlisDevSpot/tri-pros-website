import type { SectionReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { KIT_READING_SPOTS } from '@/features/trade-scenes/constants/roof-attic-flows'

import {
  KIT_FOCUS,
  KIT_GUTTER,
  KIT_INSULATION_DEPTH,
  KIT_PEEL,
  KIT_PENETRATIONS,
  KIT_PIN_Z,
  KIT_ROTATION_Y,
  LOW_SLOPE_KIT,
  LOW_SLOPE_PIN_POINTS,
  LOW_SLOPE_ROOF_TOP,
  PITCHED_COVERING_BASE,
  PITCHED_KIT,
  PITCHED_PIN_POINTS,
  PITCHED_PIN_SLOPE_SPOTS,
  PITCHED_SLOPE_LENGTH,
} from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'

export type KitPoint = [number, number, number]

type ReadingSpot = { rider: string | null } & ({ slopeAlong: number, over: number, z: number } | { point: readonly [number, number, number] })

const { halfSpan, pitch, joistDepth } = PITCHED_KIT

// The front slope's own frame placed in the kit: it starts on the wall line at the rafters' top, `along` runs up toward the
// ridge and `offset` out along the roof's normal.
export function frontSlopePoint(along: number, offset: number, z = 0): KitPoint {
  return [
    -halfSpan + along * Math.cos(pitch) - offset * Math.sin(pitch),
    joistDepth + along * Math.sin(pitch) + offset * Math.cos(pitch),
    z,
  ]
}

// A part laid on the slope must run past the rafters' end by its height above them to meet its mirror at the ridge.
export function slopeEndFor(offset: number): number {
  return PITCHED_SLOPE_LENGTH + offset * Math.tan(pitch)
}

export const PITCHED_RIDGE_TOP = frontSlopePoint(slopeEndFor(PITCHED_COVERING_BASE), PITCHED_COVERING_BASE)[1]

// The gutter hangs on the fascia just under the drip edge: [x, y] of its centre in the kit.
export function gutterCentre(form: RoofForm): readonly [number, number] {
  if (form === 'low-slope') {
    const front = -LOW_SLOPE_KIT.halfSpan - LOW_SLOPE_KIT.overhang - LOW_SLOPE_KIT.fascia
    return [front - KIT_GUTTER.width / 2, LOW_SLOPE_KIT.joistDepth - KIT_GUTTER.height / 2]
  }
  const [eaveX] = frontSlopePoint(-PITCHED_KIT.overhang, 0)
  const [, eaveTop] = frontSlopePoint(-PITCHED_KIT.overhang, PITCHED_KIT.deck)
  return [eaveX - PITCHED_KIT.fascia.thickness - KIT_GUTTER.width / 2, eaveTop - KIT_GUTTER.height / 2 - 0.03]
}

function insulationPin(form: RoofForm, material: string | null): KitPoint {
  const laid = KIT_INSULATION_DEPTH[material ?? ''] ?? 0
  const depth = form === 'low-slope' ? Math.min(laid, LOW_SLOPE_KIT.joistDepth - 0.01) : laid
  const [x, , z] = (form === 'low-slope' ? LOW_SLOPE_PIN_POINTS : PITCHED_PIN_POINTS)['attic-insulation']
  return [x, depth, z]
}

// Where a part's numbered pin sits at rest, in the kit's frame; the pin rides with the part as it peels.
export function roofAtticPinPoint(form: RoofForm, part: Pick<ResolvedPart, 'id' | 'material'>): KitPoint | null {
  if (part.id === 'attic-insulation') {
    return insulationPin(form, part.material)
  }
  if (part.id === 'air-sealing') {
    const [x, z] = KIT_PENETRATIONS.light.at
    return [x, KIT_PENETRATIONS.collar.height + 0.02, z]
  }
  if (part.id === 'gutter') {
    const [x, y] = gutterCentre(form)
    return [x, y + KIT_GUTTER.height / 2, KIT_PIN_Z]
  }
  if (form === 'low-slope') {
    const point = LOW_SLOPE_PIN_POINTS[part.id]
    return point ? [...point] : null
  }
  if (part.id === 'ridge-vent') {
    return [0, PITCHED_RIDGE_TOP + PITCHED_KIT.ridgeVent.thickness + 0.04, KIT_PIN_Z]
  }
  const spot = PITCHED_PIN_SLOPE_SPOTS[part.id]
  if (spot) {
    return frontSlopePoint(spot[0], spot[1], KIT_PIN_Z)
  }
  const point = PITCHED_PIN_POINTS[part.id]
  return point ? [...point] : null
}

// A kit point as an offset from the home's roof anchor, in the world's axes: the kit stands with its focus on the anchor,
// turned about y to face the home's front.
export function kitToAnchorOffset(form: RoofForm, point: readonly [number, number, number]): KitPoint {
  const [fx, fy, fz] = KIT_FOCUS[form]
  const [dx, dy, dz] = [point[0] - fx, point[1] - fy, point[2] - fz]
  const cos = Math.cos(KIT_ROTATION_Y)
  const sin = Math.sin(KIT_ROTATION_Y)
  return [dx * cos + dz * sin, dy, -dx * sin + dz * cos]
}

// How far from the anchor the camera should look to frame a part where the peel has carried it; null when the part has no
// spot of its own.
export function roofAtticPartFocus(form: string | null, part: Pick<ResolvedPart, 'id' | 'material'>, peel: number): KitPoint | null {
  const kitForm = homeRoofForm(form)
  const point = roofAtticPinPoint(kitForm, part)
  if (!point) {
    return null
  }
  const [dx, dy, dz] = KIT_PEEL[kitForm][part.id] ?? [0, 0, 0]
  return kitToAnchorOffset(kitForm, [point[0] + dx * peel, point[1] + dy * peel, point[2] + dz * peel])
}

export const LOW_SLOPE_PARAPET_TOP = LOW_SLOPE_ROOF_TOP + LOW_SLOPE_KIT.parapet.height

// Where one of the section's readings is pinned at rest; a reading with a rider is drawn inside that part, so it rides the peel.
export function roofAtticReadingPoint(form: RoofForm, reading: SectionReadingId): KitPoint {
  const spot: ReadingSpot = KIT_READING_SPOTS[form][reading]
  if ('slopeAlong' in spot) {
    return frontSlopePoint(spot.slopeAlong, PITCHED_COVERING_BASE + spot.over, spot.z)
  }
  return [...spot.point]
}

export function roofAtticReadingRider(form: RoofForm, reading: SectionReadingId): string | null {
  return KIT_READING_SPOTS[form][reading].rider
}
