import type { HomeSystemId, StageShape } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'
import type { HVACType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_ANCHORS, READING_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { EQUIPMENT, HOME_FRAMINGS } from '@/features/trade-scenes/constants/home-geometry'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { packageUnitPlacement } from '@/features/trade-scenes/lib/package-unit-placement'

// Every system is looked at from the home's own direction, nearer by this factor, so a glide between two systems slides
// along the house instead of swinging around it. It brings a system about twice as close as the whole home, as the
// rep sees it: on a wide stage the card beside the system narrows the view and the lens widens to fit it, so the camera
// comes nearer there to make up for it. Working numbers, tuned by eye.
const SYSTEM_VIEW_NEARER = { landscape: 3.3, narrow: 3.3, portrait: 2.4 } as const satisfies Record<StageShape, number>
const SYSTEM_VIEW_FOV = 34
const [homeX, homeY, homeZ] = HOME_FRAMINGS.wide.position
const [aimX, aimY, aimZ] = HOME_FRAMINGS.wide.target

function viewOf(target: readonly [number, number, number], shape: StageShape, lift: number): CameraFraming {
  const [x, y, z] = target
  const nearer = SYSTEM_VIEW_NEARER[shape]
  return liftedFraming({ position: [x + (homeX - aimX) / nearer, y + (homeY - aimY) / nearer, z + (homeZ - aimZ) / nearer], target: [x, y, z], fov: SYSTEM_VIEW_FOV }, lift)
}

// A package unit stands behind the ridge on the far slope, so its view keeps the home's bearing and distance but rises
// until every sight line to the curb's back foot clears the ridge cap: about 34 degrees, against the home view's 12.
// A working number, set by eye.
const OVER_THE_RIDGE = 0.6

function overTheRidgeViewOf(target: readonly [number, number, number], shape: StageShape, lift: number): CameraFraming {
  const [x, y, z] = target
  const nearer = SYSTEM_VIEW_NEARER[shape]
  const [dx, dy, dz] = [(homeX - aimX) / nearer, (homeY - aimY) / nearer, (homeZ - aimZ) / nearer]
  const distance = Math.hypot(dx, dy, dz)
  const ground = Math.hypot(dx, dz)
  const across = distance * Math.cos(OVER_THE_RIDGE) / ground
  return liftedFraming({ position: [x + dx * across, y + distance * Math.sin(OVER_THE_RIDGE), z + dz * across], target: [x, y, z], fov: SYSTEM_VIEW_FOV }, lift)
}

// What heating & cooling needs to find the home's outdoor equipment: the system, and the size it is drawn at.
interface HomeHvac {
  type: HVACType | null
  scale: number
}

// Heating & cooling looks at a package unit where it stands on the roof, over the ridge on a gable, and at the condenser's
// pad for any other system. The pad stands on the ground, so it takes no lift from the foundation; the unit rises with the
// house.
export const SYSTEM_CAMERA_VIEWS: Record<HomeSystemId, (form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac) => CameraFraming> = {
  'roof': (form, shape, lift) => viewOf(HOME_ANCHORS[form].roof.position, shape, lift),
  'attic': (form, shape, lift) => viewOf(HOME_ANCHORS[form].attic.position, shape, lift),
  'windows': (form, shape, lift) => viewOf(READING_ANCHORS[form].window, shape, lift),
  'walls': (form, shape, lift) => viewOf(READING_ANCHORS[form]['exterior-wall'], shape, lift),
  'heating-cooling': (form, shape, lift, { type, scale }) => type === 'package-unit'
    ? (form === 'low-slope' ? viewOf : overTheRidgeViewOf)(packageUnitPlacement(form === 'low-slope', scale).position, shape, lift)
    : viewOf(EQUIPMENT.condenser.position, shape, 0),
  'foundation': (form, shape, lift) => viewOf(HOME_ANCHORS[form]['under-floor'].position, shape, lift),
}

// How each system is looked at up close, from its own view: `distance` is the share of that view's reach kept, `turn` swings
// the bearing toward the left gable (radians, about the target's vertical) and `elevation` sets the angle above level in
// place of the view's own. The roof and the windows come straight in. The attic sits under the near slope, so up close goes
// inside it: in at the left end, nearly level over the insulation, with no shingles between the lens and the floor it looks
// down the length of. The condenser's pad is between the house and the lot's left wall, so up close swings in front of it
// and looks down the side yard from inside the wall. Working numbers, set by eye.
const LOOK_INSIDE_VIEWS = {
  'roof': { distance: 0.62, turn: 0, elevation: null },
  'attic': { distance: 0.43, turn: 0.76, elevation: 0.035 },
  'windows': { distance: 0.62, turn: 0, elevation: null },
  'walls': { distance: 0.62, turn: 0, elevation: null },
  'heating-cooling': { distance: 0.62, turn: 0, elevation: null },
  'condenser-pad': { distance: 0.5, turn: -0.35, elevation: 0.44 },
  'foundation': { distance: 0.62, turn: 0, elevation: null },
} as const satisfies Record<HomeSystemId | 'condenser-pad', { distance: number, turn: number, elevation: number | null }>

export function lookInsideView(system: HomeSystemId, form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac): CameraFraming {
  const { position, target, fov } = SYSTEM_CAMERA_VIEWS[system](form, shape, lift, hvac)
  const { distance, turn, elevation } = LOOK_INSIDE_VIEWS[system === 'heating-cooling' && hvac.type !== 'package-unit' ? 'condenser-pad' : system]
  const [dx, dy, dz] = [0, 1, 2].map(axis => position[axis] - target[axis])
  const reach = Math.hypot(dx, dy, dz) * distance
  const rise = elevation ?? Math.atan2(dy, Math.hypot(dx, dz))
  const bearing = Math.atan2(dx, dz) - turn
  return {
    position: [target[0] + reach * Math.cos(rise) * Math.sin(bearing), target[1] + reach * Math.sin(rise), target[2] + reach * Math.cos(rise) * Math.cos(bearing)],
    target,
    fov,
  }
}

// While a system part is emphasised the camera's target moves this share of the way to it, and the camera closes in by
// this factor. Working numbers.
export const PART_EMPHASIS_FRAMING = { share: 0.8, dolly: 0.78 } as const
