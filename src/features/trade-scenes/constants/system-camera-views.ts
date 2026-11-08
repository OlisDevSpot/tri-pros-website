import type { HomeSystemId, StageShape, SystemPartId, Vec3 } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'
import type { HVACType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_ANCHORS, READING_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { ATTIC_FAN_SPOT, EQUIPMENT, FASCIA_CENTRE, FRONT_WALL, HOME_FRAMINGS, HOUSE, LOW_SLOPE, PARAPET_TOP, RAFTER_ORIGIN_Y, ROOF_HALF_LENGTH, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { LOOK_INSIDE_WALL, LOOK_INSIDE_WINDOW } from '@/features/trade-scenes/constants/look-inside'
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

// The windows' view looks at the window that comes apart up close, on its lower pane at its inside face, where the arrows
// cross it; the whole home's window reading and spot stay on a window every home view draws. Working numbers, set by screenshot.
const WINDOW_VIEW_TARGET: readonly [number, number, number] = (() => {
  const { wall, opening } = LOOK_INSIDE_WINDOW
  const [y, across] = [HOUSE.floorY + 1.15, wall.line - wall.outward * HOUSE.wallThickness / 2]
  return wall.run === 'x' ? [opening.along, y, across] : [across, y, opening.along]
})()

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
  'windows': (_form, shape, lift) => viewOf(WINDOW_VIEW_TARGET, shape, lift),
  'walls': (form, shape, lift) => viewOf(READING_ANCHORS[form]['exterior-wall'], shape, lift),
  'heating-cooling': (form, shape, lift, { type, scale }) => type === 'package-unit'
    ? (form === 'low-slope' ? viewOf : overTheRidgeViewOf)(packageUnitPlacement(form === 'low-slope', scale).position, shape, lift)
    : viewOf(EQUIPMENT.condenser.position, shape, 0),
  'foundation': (form, shape, lift) => viewOf(HOME_ANCHORS[form]['under-floor'].position, shape, lift),
}

// How each system is looked at up close, from its own view: `distance` is the share of that view's reach kept (by stage shape
// where a tall stage's further view would leave its parts too small), `turn` swings the bearing toward the left gable
// (radians, about the target's vertical) and `elevation` sets the angle above level in place of the view's own; `target`,
// where given, is looked at in place of the view's. The roof comes straight in. The attic holds the house
// open, so up close it comes in low through the lifted near slope over the cut, under the back slope, and looks across the
// steps its floor opens on the span the open house keeps: the bare strip by the cut with the light can, the duct boot and
// the vent pipe on it, each in its foam once sealed, and the blanket's step just past them, with the heat coming down onto
// it. The condenser's pad is between the house and the lot's left wall, so up close swings in front of it and looks down
// the side yard from inside the wall. Working numbers, set by eye.
interface LookInsideView {
  distance: number | Readonly<Record<StageShape, number>>
  turn: number
  elevation: number | null
  target?: readonly [number, number, number]
}

const LOOK_INSIDE_VIEWS: Record<HomeSystemId | 'condenser-pad', LookInsideView> = {
  'roof': { distance: 0.62, turn: 0, elevation: null },
  // A tall stage comes nearer, so the steps, the can and their pins read on a phone. Working numbers, set by a dark shot.
  'attic': { distance: { landscape: 0.36, narrow: 0.36, portrait: 0.25 }, turn: 0.45, elevation: 0.3, target: [HOUSE.cutX + 0.9, WALL_TOP_Y, HOUSE.atticFrontZ - 1.4] },
  // The front window faces the home's own view nearly square, so pulled apart its parts would stack toward the camera: up
  // close swings round from the front yard toward the door, so the wall's outward normal runs across the view and the
  // window spreads sideways, from the flashing at the wall to the screen, and stays in frame. It comes about as near as the
  // orbit allows for its parts and their pins to read; a tall stage comes nearer, so they read on a phone. Working numbers,
  // set by a dark shot.
  'windows': { distance: { landscape: 0.35, narrow: 0.35, portrait: 0.25 }, turn: 0.6, elevation: null },
  // The wall is looked at in the side yard, so up close swings round to its face from inside the gate, a little above it, and
  // looks at where the heat crosses it; a tall stage keeps less of its further view, so the lanes read on a phone too.
  // Working numbers.
  'walls': { distance: { landscape: 0.35, narrow: 0.35, portrait: 0.25 }, turn: 0.665, elevation: 0.5, target: [LOOK_INSIDE_WALL.wall.line + LOOK_INSIDE_WALL.wall.outward * HOUSE.wallThickness / 2, HOUSE.floorY + LOOK_INSIDE_WALL.height, LOOK_INSIDE_WALL.along] },
  // Near enough that the duct run's opened steps by the plenum read beside the package unit. A working number.
  'heating-cooling': { distance: 0.48, turn: 0, elevation: null },
  'condenser-pad': { distance: 0.5, turn: -0.35, elevation: 0.44 },
  'foundation': { distance: 0.62, turn: 0, elevation: null },
}

// A part that stands off the run its system's view looks along has a look of its own when picked, in place of the lean
// toward it: the attic fan sits in the left gable's vent, behind the attic's view, so a pick on it turns to face the gable
// from inside the attic, through the lifted near slope. Working numbers, set by a dark shot.
const PART_LOOK_INSIDE_VIEWS: Partial<Record<SystemPartId, LookInsideView>> = {
  'attic-fan': { distance: 0.36, turn: -1.6, elevation: 0.15, target: ATTIC_FAN_SPOT.position },
}

function lookedAtFrom(look: LookInsideView, system: HomeSystemId, form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac): CameraFraming {
  const { position, target, fov } = SYSTEM_CAMERA_VIEWS[system](form, shape, lift, hvac)
  const { distance, turn, elevation, target: own } = look
  const [dx, dy, dz] = [0, 1, 2].map(axis => position[axis] - target[axis])
  // Its own target is drawn on the house at rest, so it rises with the house as the view's does.
  const aim: CameraFraming['target'] = own === undefined ? target : [own[0], own[1] + lift, own[2]]
  const reach = Math.hypot(dx, dy, dz) * (typeof distance === 'number' ? distance : distance[shape])
  const rise = elevation ?? Math.atan2(dy, Math.hypot(dx, dz))
  const bearing = Math.atan2(dx, dz) - turn
  return {
    position: [aim[0] + reach * Math.cos(rise) * Math.sin(bearing), aim[1] + reach * Math.sin(rise), aim[2] + reach * Math.cos(rise) * Math.cos(bearing)],
    target: aim,
    fov,
  }
}

export function lookInsideView(system: HomeSystemId, form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac): CameraFraming {
  return lookedAtFrom(LOOK_INSIDE_VIEWS[system === 'heating-cooling' && hvac.type !== 'package-unit' ? 'condenser-pad' : system], system, form, shape, lift, hvac)
}

// The look a picked part has of its own, or null for one the system's view leans toward.
export function partLookInsideView(system: HomeSystemId, part: SystemPartId, form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac): CameraFraming | null {
  const look = PART_LOOK_INSIDE_VIEWS[part]
  return look === undefined ? null : lookedAtFrom(look, system, form, shape, lift, hvac)
}

// While a system part is emphasised the camera's target moves this share of the way to it, and the camera closes in by
// this factor. Working numbers.
export const PART_EMPHASIS_FRAMING = { share: 0.8, dolly: 0.78 } as const

// The walls' view looks at the left wall, which leaves the eaves at its top edge, so the Eaves & trim pick leans toward them:
// toward the front eave's fascia `along` it from where the left rake meets it, or on a flat roof toward the front coping as far
// from the left wall. The wall has no pins, so these points drive the lean alone. Working numbers, set by screenshot.
const EAVES_LEAN = { along: 0.6 } as const
// The fascia's centre turned out of its slope's frame onto the front eave.
const [FASCIA_ALONG, FASCIA_UP] = FASCIA_CENTRE
const [SIN, COS] = [Math.sin(HOUSE.pitch), Math.cos(HOUSE.pitch)]
export const WALL_LEAN_POINTS: Record<RoofForm, Partial<Record<SystemPartId, Vec3>>> = {
  'pitched': {
    'eaves-trim': [-ROOF_HALF_LENGTH + EAVES_LEAN.along, RAFTER_ORIGIN_Y + FASCIA_ALONG * SIN + FASCIA_UP * COS, HOUSE.halfDepth - (FASCIA_ALONG * COS - FASCIA_UP * SIN)],
  },
  'low-slope': {
    'eaves-trim': [-HOUSE.halfLength + EAVES_LEAN.along, PARAPET_TOP + LOW_SLOPE.coping / 2, FRONT_WALL.line],
  },
}
