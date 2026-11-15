import type { HvacFocus } from '@/features/trade-scenes/lib/hvac-focus-of'
import type { HomeSystemId, StageShape, SystemPartId, Vec3 } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'
import type { HvacIndoorLocation } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_ANCHORS, READING_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { ATTIC_FAN_SPOT, BACK_INNER, EQUIPMENT, FASCIA_CENTRE, FRONT_WALL, HOME_FRAMINGS, HOUSE, HOUSE_WALLS, LOW_SLOPE, PARAPET_TOP, RAFTER_ORIGIN_Y, ROOF_HALF_LENGTH, ROOMS, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { LOOK_INSIDE_WALL, LOOK_INSIDE_WINDOW, STEP_CUTS } from '@/features/trade-scenes/constants/look-inside'
import { indoorUnitBoxes } from '@/features/trade-scenes/lib/indoor-unit-boxes'
import { indoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
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

// `turn` swings the bearing about the target's vertical, as up close's does, for a system the home's own bearing would see
// through a wall.
function viewOf(target: readonly [number, number, number], shape: StageShape, lift: number, turn = 0): CameraFraming {
  const [x, y, z] = target
  const nearer = SYSTEM_VIEW_NEARER[shape]
  const [dx, dz] = [(homeX - aimX) / nearer, (homeZ - aimZ) / nearer]
  const [sin, cos] = [Math.sin(-turn), Math.cos(-turn)]
  return liftedFraming({ position: [x + dx * cos + dz * sin, y + (homeY - aimY) / nearer, z - dx * sin + dz * cos], target: [x, y, z], fov: SYSTEM_VIEW_FOV }, lift)
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

// What heating & cooling needs to find the system doing the home's work: what it looks at, and the size a package unit is
// drawn at.
interface HomeHvac {
  focus: HvacFocus
  scale: number
}

// The middle of the indoor unit, its plenum included, where its location stands it. A location with no place of its own yet
// is drawn in the closet.
function indoorUnitCentre(location: HvacIndoorLocation, form: RoofForm): Vec3 {
  const placement = indoorUnitPlacement(location, form) ?? indoorUnitPlacement('closet', form)!
  const boxes = indoorUnitBoxes(placement, { furnace: true, coil: true }).map(section => section.box)
  const span = (axis: 0 | 1 | 2) => {
    const low = Math.min(...boxes.map(({ position, size }) => position[axis] - size[axis] / 2))
    const high = Math.max(...boxes.map(({ position, size }) => position[axis] + size[axis] / 2))
    return (low + high) / 2
  }
  return [span(0), span(1), span(2)]
}

// The wall unit and the window unit are looked at on the back wall's inside, where the room sees them: the wall unit at its
// own height, the window unit on its window's sill.
const WALL_UNIT_TARGET: Vec3 = [EQUIPMENT.wallUnit.x, EQUIPMENT.wallUnit.y, BACK_INNER]
const WINDOW_UNIT_TARGET: Vec3 = [EQUIPMENT.windowUnit.x, HOUSE.floorY + HOUSE_WALLS.back.openings[0].sill + EQUIPMENT.windowUnit.size[1] / 2, BACK_INNER]
// The closet stands against the left wall, which the home's own bearing looks through, so its view swings round to the open
// front and looks in past the bedroom. A working number, set by screenshot.
const CLOSET_VIEW_TURN = -0.64

// Until the heads have places of their own, the living room's is looked for on its back wall, high where a head hangs.
const LIVING_ROOM_HEAD_TARGET: Vec3 = [(ROOMS.living.from + ROOMS.living.to) / 2, HOUSE.floorY + 2.1, BACK_INNER]

function heatingCoolingView(form: RoofForm, shape: StageShape, lift: number, { focus, scale }: HomeHvac): CameraFraming {
  switch (focus.kind) {
    case 'package':
      return (form === 'low-slope' ? viewOf : overTheRidgeViewOf)(packageUnitPlacement(form === 'low-slope', scale).position, shape, lift)
    case 'indoor':
      return viewOf(indoorUnitCentre(focus.location, form), shape, lift, focus.location === 'attic' ? 0 : CLOSET_VIEW_TURN)
    case 'mini-split-head':
      return viewOf(LIVING_ROOM_HEAD_TARGET, shape, lift)
    case 'wall-unit':
      return viewOf(WALL_UNIT_TARGET, shape, lift)
    case 'window-unit':
      return viewOf(WINDOW_UNIT_TARGET, shape, lift)
  }
}

// Heating & cooling looks at the system doing the home's work: its indoor unit, in the attic or its closet, a package unit
// where it stands on the roof, over the ridge on a gable, or the unit that heats or cools a room. Each rises with the house.
export const SYSTEM_CAMERA_VIEWS: Record<HomeSystemId, (form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac) => CameraFraming> = {
  'roof': (form, shape, lift) => viewOf(HOME_ANCHORS[form].roof.position, shape, lift),
  'attic': (form, shape, lift) => viewOf(HOME_ANCHORS[form].attic.position, shape, lift),
  'windows': (_form, shape, lift) => viewOf(WINDOW_VIEW_TARGET, shape, lift),
  'walls': (form, shape, lift) => viewOf(READING_ANCHORS[form]['exterior-wall'], shape, lift),
  'heating-cooling': heatingCoolingView,
  'foundation': (form, shape, lift) => viewOf(HOME_ANCHORS[form]['under-floor'].position, shape, lift),
}

// How each system is looked at up close, from its own view: `distance` is the share of that view's reach kept (by stage shape
// where a tall stage's further view would leave its parts too small), `turn` swings the bearing toward the left gable
// (radians, about the target's vertical) and `elevation` sets the angle above level in place of the view's own; `target`,
// where given, is looked at in place of the view's; `base: 'condenser'` takes the look from the condenser's own view in
// place of the system's. The roof comes straight in. Working numbers, set by eye.
interface LookInsideView {
  distance: number | Readonly<Record<StageShape, number>>
  turn: number
  elevation: number | null
  target?: readonly [number, number, number]
  base?: 'condenser'
}

const ATTIC_LOOK_INSIDE_DISTANCE = { landscape: 0.36, narrow: 0.36, portrait: 0.25 } as const satisfies Record<StageShape, number>

// The attic holds the house open, so up close it comes in through the lifted near slope, under the back slope, and looks
// across the steps its floor opens where its roof's attic opens; a tall stage comes nearer, so the steps and their pins read
// on a phone. Under a gable it stands at the attic's left end, just inside the gable wall, over the bare strip in the
// left-end bay, with the light can, the duct boot and the vent pipe on it, each in its foam once sealed. The gable wall keeps
// it near that end and the card covers the right of a wide stage, so it looks toward the right gable on a diagonal: turned
// far enough that the blanket's edge runs away toward the far gable in the open part of the stage, not so far that the
// bay's three openings leave the frame. Working numbers, set by a dark shot.
const ATTIC_LOOK_INSIDE_VIEWS: Record<RoofForm, LookInsideView> = {
  'pitched': { distance: ATTIC_LOOK_INSIDE_DISTANCE, turn: 0.29, elevation: 0.4, target: [STEP_CUTS.pitched.attic + 0.75, WALL_TOP_Y, HOUSE.atticFrontZ - 1.5] },
  'low-slope': { distance: ATTIC_LOOK_INSIDE_DISTANCE, turn: 0.45, elevation: 0.3, target: [STEP_CUTS['low-slope'].attic + 0.9, WALL_TOP_Y, HOUSE.atticFrontZ - 1.4] },
}

const LOOK_INSIDE_VIEWS: Record<Exclude<HomeSystemId, 'attic'> | 'indoor-attic' | 'indoor-closet', LookInsideView> = {
  'roof': { distance: 0.62, turn: 0, elevation: null },
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
  // The attic unit runs away from the home's own view, so up close swings round to see its sections side on, from over the
  // left rooms where the open house lifts the near slope. The closet's view already looks in from the open front, so up
  // close comes in along it, a little higher, into the bedroom. Working numbers, set by screenshot.
  'indoor-attic': { distance: 0.48, turn: 0.65, elevation: 0.45 },
  'indoor-closet': { distance: 0.48, turn: 0, elevation: 0.35 },
  'foundation': { distance: 0.62, turn: 0, elevation: null },
}

// The condenser's pad is between the house and the lot's left wall, so a pick on the condenser or the lines that come down
// to it swings in front of the pad and looks down the side yard from inside the wall. Working numbers, set by eye.
const CONDENSER_PAD_LOOK: LookInsideView = { distance: 0.5, turn: -0.35, elevation: 0.44, base: 'condenser' }

// A part that stands off the run its system's view looks along has a look of its own when picked, in place of the lean
// toward it: the attic fan sits in the left gable's vent, behind the attic's view, so a pick on it turns to face the gable
// from inside the attic, through the lifted near slope; the condenser and its line set stand outside, on the pad. Working
// numbers, set by a dark shot.
const PART_LOOK_INSIDE_VIEWS: Partial<Record<SystemPartId, LookInsideView>> = {
  'attic-fan': { distance: 0.36, turn: -1.6, elevation: 0.15, target: ATTIC_FAN_SPOT.position },
  'condenser': CONDENSER_PAD_LOOK,
  'refrigerant-lines': CONDENSER_PAD_LOOK,
}

// The pad stands on the ground, so the condenser's own view takes no lift from the foundation.
function baseView(look: LookInsideView, system: HomeSystemId, form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac): CameraFraming {
  return look.base === 'condenser' ? viewOf(EQUIPMENT.condenser.position, shape, 0) : SYSTEM_CAMERA_VIEWS[system](form, shape, lift, hvac)
}

function lookedAtFrom(look: LookInsideView, system: HomeSystemId, form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac): CameraFraming {
  const { position, target, fov } = baseView(look, system, form, shape, lift, hvac)
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

// Heating & cooling comes up close on its indoor unit where the home has one; anything else is looked at as its view does.
function systemLook(system: HomeSystemId, form: RoofForm, { focus }: HomeHvac): LookInsideView {
  if (system === 'attic') {
    return ATTIC_LOOK_INSIDE_VIEWS[form]
  }
  if (system === 'heating-cooling' && focus.kind === 'indoor') {
    return LOOK_INSIDE_VIEWS[focus.location === 'attic' ? 'indoor-attic' : 'indoor-closet']
  }
  return LOOK_INSIDE_VIEWS[system]
}

export function lookInsideView(system: HomeSystemId, form: RoofForm, shape: StageShape, lift: number, hvac: HomeHvac): CameraFraming {
  return lookedAtFrom(systemLook(system, form, hvac), system, form, shape, lift, hvac)
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
