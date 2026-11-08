import type { HomeSystemId, PartPaintFaces, SystemPartId, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { FRONT_WALL, HOME_GHOST_OPACITY, HOUSE_WALLS } from '@/features/trade-scenes/constants/home-geometry'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'

export const LOOK_INSIDE = {
  ghostOpacity: HOME_GHOST_OPACITY,
  // A tapped system part stays whole; the rest of its system fades back to this so it reads on its own. A working number.
  dimmedOpacity: 0.25,
  // Pins crowd a closed roof, so they show once it is this far open. A working number.
  pinsFromPeel: 0.2,
} as const

// How far each system part is cut back past the one under it, fully peeled, in metres. Working numbers. The attic's is
// one joist bay past the cut, so the blanket's step edge stands out in plain view, and the strip its air sealing shows holds
// the light can, the duct boot and the vent pipe in that bay, each with its foam clear of the step. The wall is looked
// inside whole and the window pulls apart, so neither steps.
export const STEP_DEPTHS = {
  'roof': 0.45,
  'attic': 0.8,
  'heating-cooling': 0.25,
} as const satisfies Record<'roof' | 'attic' | 'heating-cooling', number>

// These stand fully stepped open up close, with no peel to drag.
export const FULLY_OPEN_SYSTEM_IDS = ['attic'] as const satisfies readonly (keyof typeof STEP_DEPTHS)[]
export const FULLY_OPEN_SYSTEMS: ReadonlySet<HomeSystemId> = new Set(FULLY_OPEN_SYSTEM_IDS)

// These come apart up close instead of stepping open: the slider slides their parts apart, whole, nothing cut back.
export const PULLED_APART_SYSTEM_IDS = ['windows'] as const satisfies readonly HomeSystemId[]
export const PULLED_APART_SYSTEMS: ReadonlySet<HomeSystemId> = new Set(PULLED_APART_SYSTEM_IDS)

// Pulled fully apart, each of the window's parts stands this much further out along the wall's normal than the part inside
// it, in metres. A working number, set by screenshot.
export const WINDOW_SPREAD = { step: 0.08 } as const

// Beside the edge parts, these sit off the run a stepped cutaway opens: the ridge vent along the ridge, the attic fan on its
// gable end, the radiant barrier on the rafters, a plane apart from the attic floor's steps, so it never hides them. They
// stay whole where they stand.
export const UNSTEPPED_SYSTEM_PARTS = ['ridge-vent', 'attic-fan', 'radiant-barrier', 'ceiling-joists'] as const satisfies readonly SystemPartId[]

// The window the windows view frames, which comes apart into its system parts up close: the front window right of the door,
// seen from the front yard, where the side yard's fence never stands in the way.
export const LOOK_INSIDE_WINDOW = { wall: FRONT_WALL, opening: FRONT_WALL.openings[1] } as const

// The framed window stands in the front wall, which only the Complete house draws and every Look inside ghosts, so each of its
// system parts is tagged to light over that faded front.
export const LOOK_INSIDE_WINDOW_TAG = { overFront: true } as const

// Where the window's heat lanes cross every one of its parts, along its wall: in the glass, clear of the frame's bars and of
// the pins down the glass's other side. A working number, set by screenshot.
export const WINDOW_LANE_ALONG = 1.65

// Where the Walls Look inside looks at the wall, which it shows whole, and where the heat's lanes cross it: in the side yard,
// on the left wall's stucco between the framed window and the electric meter, which the camera looks at from inside the gate,
// `height` metres above the floor. Working numbers, set by screenshot.
export const LOOK_INSIDE_WALL = { wall: HOUSE_WALLS.left, along: 1.85, height: 1.325 } as const

// The duct run heating & cooling opens into its system parts, stepped from its plenum end: the run toward the left gable, on
// the condenser's side of the attic. A working number.
export const LOOK_INSIDE_DUCT_RUN = 0

const piecesOn = (part: string): SystemPartId[] => SYSTEM_PARTS.filter(entry => entry.part === part && entry.id !== part).map(entry => entry.id)

// The pieces drawn on one construction part, in list order: the window's inside out, the duct run's in the order its steps
// open. A stepped run takes the ones that show.
export const PART_PIECES = {
  'glazing': piecesOn('glazing'),
  'frame': piecesOn('frame'),
  'duct-runs': piecesOn('duct-runs'),
} as const

// A duct piece's pin stands this far over the run's line, the outer the higher, so the three stand apart while the steps are
// closed. Working numbers.
export const DUCT_PIN_RISE = { jacket: 0.14, blanket: 0.09, core: 0.04 } as const satisfies Partial<Record<SystemPartId, number>>

// The flows drawn through the stepped roof and attic, in the house's metres. Working numbers, set by eye.
export const CUTAWAY_FLOW = {
  // A full flow (share 1) draws this wide; a share is drawn to scale, so the narrowing is the story.
  width: 0.2,
  // A share above zero never draws thinner than this, so a small flow still reads as a thread.
  minWidth: 0.035,
  // The flows cross each part just in front of its step's cut end, where the part shows its section, so it never hides them.
  front: 0.03,
  // How far up the near slope, from the rafters' line at the wall, the line crosses the gable's parts: above their pins.
  pitchedAlong: 2.75,
  // Where the line crosses a flat roof, between its pins and the front wall.
  lowSlopeZ: 1,
  // From where a flow lands on the top step to where the sun or the rain comes from, and where winter heat escapes to.
  sky: { 'pitched': [0, 1.1, 0.15], 'low-slope': [0, 1, 0.3] } as const satisfies Record<RoofForm, Vec3>,
  // The sun the covering turns back, off its slope toward the yard.
  reflected: { 'pitched': [0, 0.45, 0.6], 'low-slope': [0, 0.75, 0.3] } as const satisfies Record<RoofForm, Vec3>,
  // On the gable the heat meets the barrier this far further down the slope than it crossed the deck, so the arrows from the
  // covering to the barrier have room to read apart.
  barrierAlong: 0.4,
  // The heat the barrier turns back, as [toward the eave, up toward the deck] from the foil's underside: back into the
  // rafter bay, ending under the deck, so it never reads as leaving through the roof. Only a gable has a barrier.
  barrierBounce: [0.5, 0.1] as const,
  // A flat roof's parts sit a hand's width over its ceiling, too close for the arrows into the joist space to read apart
  // on a plumb line, so the heat crosses them this much further toward the yard, the higher the further, and slants back.
  lowSlopeHeat: { out: 0.6, slant: 0.3 },
  // Below the ceiling, into the room under it.
  room: 0.42,
  // Water rides this high over the surface it sheds along.
  sheetOver: 0.025,
  // Water leaves the drip edge just out from its lip.
  offEdge: [0, -0.06, 0.03] as const satisfies Vec3,
  // Where nothing catches it, water off the edge falls this far.
  spill: [0, -0.9, 0.08] as const satisfies Vec3,
  // A part thinner than this along the line gets one station at its middle instead of one per face.
  faceStationMin: 0.02,
  // Below this the flow has stopped.
  stopped: 1e-3,
  // Kept low enough that the core keeps its hue under the additive glow instead of burning white.
  intensity: 1.3,
  // Scroll speed while a burst runs.
  speed: 0.6,
  // The house's drip, drawn this much larger up close so a drop reads on the lit ceiling.
  dripScale: 1.8,
} as const

// The attic holds the house open, which lifts away the near slope over the rooms and the attic floor's front span, so its
// heat comes down through the back slope onto the span the open house keeps, along the house where its floor's top step
// shows: crossing the deck `along` up the slope from the back wall and meeting the foil `barrierAlong` further down it, so
// the arrows into the foil read apart; under a flat roof, at `lowSlopeZ`. The roof's own line stays on the near slope.
// Working numbers, set by a dark shot.
export const ATTIC_HEAT_LINE = { along: 3.2, barrierAlong: 0.7, lowSlopeZ: -1.2 } as const

// How far each covering stands off its underlayment, where a flow meets its outer face. Working numbers.
export const CUTAWAY_COVERING_RISE: Readonly<Record<string, number>> = {
  'default': 0.03,
  'tile': 0.13,
  'wood-shake': 0.04,
}

// The wood the rain rots where it crosses it on the line.
export const ROTTING_SYSTEM_PARTS = ['deck'] as const satisfies readonly SystemPartId[]

// A rot stain's half-width at a full soak; a part up to `throughMax` thick is stained right through. It sits `aside` toward
// the yard from where the rain crosses, so the ribbon never covers it. Working numbers.
export const CUTAWAY_ROT = {
  radius: 0.55,
  lift: 0.004,
  throughMax: 0.05,
  aside: 0.45,
  // A water stain's soft, uneven shape: overlapping round lobes [x, y, radius, strength] on a square, each fading out by `stops`
  // [from its centre, strength], every lobe clear of the square's edge so no stain ends in a line. `alpha` is how dark its middle
  // reads. Working numbers, set by screenshot.
  stain: {
    lobes: [[0.5, 0.5, 0.4, 1], [0.34, 0.4, 0.27, 0.85], [0.66, 0.6, 0.3, 0.9], [0.56, 0.3, 0.2, 0.7], [0.4, 0.7, 0.22, 0.75]],
    stops: [[0, 1], [0.45, 0.8], [1, 0]],
    alpha: 0.85,
  },
  // How far a replaced sheet's darker seam shows round it, on each side. A working number, set by screenshot.
  seam: 0.015,
  // The old deck's own rot, on its step whatever the weather, as three differently sized rectangles. Each is `across` the strip the
  // step shows and `up` the run it spans, both as fractions: `across` may pass 1 to run on under the next step. Working numbers,
  // set by screenshot.
  deck: {
    sheets: [
      { across: [0.06, 0.72], up: [0.2, 0.39] },
      { across: [0.28, 1.3], up: [0.45, 0.68] },
      { across: [0.12, 0.9], up: [0.74, 0.915] },
    ],
  },
} as const

// Where the three readings pin on the steps: the roof's on the covering, along its step from the flows, the attic's
// in the air beside them, the ceiling's under the ceiling near the front wall, so the labels stand clear of the arrows.
// Working numbers, set by eye.
export const CUTAWAY_READINGS = {
  // Along the covering's step from the line, clear of the sun's arrows.
  onCovering: 0.9,
  pitched: { roofAlong: 0.3, over: 0.06, atticRise: 0.65, atticBack: 1.1 },
  lowSlope: { roofBack: 0.7, atticShare: 0.75, atticFront: 0.7 },
  ceilingBelow: 0.05,
  ceilingFromFront: 0.5,
  // Up close on the attic the roof's and the attic's readings stand this far left of its line, the attic's in the air over
  // the blanket, and the ceiling's this far behind the kept ceiling's cut edge, where the open house shows it.
  attic: { aside: 0.6, ceilingBack: 0.35 },
} as const

// The readings a lit part's two faces take, so the painted steps and the zones round them wear one colour. Any part not
// listed faces the attic inside and the roof's reading outside.
export const PART_PAINT_FACES: Partial<Record<SystemPartId, PartPaintFaces>> = {
  'ceiling': { inner: 'ceiling', outer: 'attic' },
  'air-sealing': { inner: 'ceiling', outer: 'attic' },
  'attic-insulation': { inner: 'ceiling', outer: 'attic' },
  'rafters': { inner: 'attic', outer: 'attic' },
  'ceiling-joists': { inner: 'attic', outer: 'attic' },
  'radiant-barrier': { inner: 'attic', outer: 'attic' },
  'attic-fan': { inner: 'attic', outer: 'attic' },
}

export const DEFAULT_PART_PAINT_FACES: PartPaintFaces = { inner: 'attic', outer: 'roof' }

// The dust where the ceiling leaks air, lying on the blanket over each opening: a patch's side, its thickness, how far it
// floats over the blanket's top, and how dark its middle reads. Working numbers, set by screenshot.
export const ATTIC_DUST = { size: 0.6, thickness: 0.004, lift: 0.006, alpha: 0.7 } as const
