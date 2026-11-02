import type { BoxSpec, CeilingOpening, HouseWall, RoomSpan, WallOpening } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'

import { ATTIC_FAN_LOOK } from '@/features/trade-scenes/constants/attic-fan-look'
import { FOUNDATION, GABLE_VENT, REGISTER_BOOT, ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { SKY_RIG } from '@/features/trade-scenes/constants/weather-skies'
import { eaveFasciaCentre } from '@/features/trade-scenes/lib/eave-fascia'
import { framingGrid } from '@/features/trade-scenes/lib/home-roof-layout'
import { rafterProfile } from '@/features/trade-scenes/lib/rafter-profile'

// Metres. A one-story SoCal ranch, 12 × 8 m, centred on the origin: the ridge runs along x and the open front faces +z,
// toward the camera.
export const HOUSE = {
  halfLength: 6,
  halfDepth: 4,
  // Trap: the height the house is drawn at, not where its floor stands. That is `homeFloorY`, by foundation; the lift group
  // carries the difference, so every anchor keeps its place on the house.
  floorY: 0.45,
  wallHeight: 2.5,
  wallThickness: 0.16,
  partitionThickness: 0.1,
  paintThickness: 0.012,
  ceilingThickness: 0.016,
  floorThickness: 0.03,
  joistDepth: 0.14,
  joistWidth: 0.045,
  framingSpacing: 0.6,
  pitch: Math.atan(4 / 12),
  // The rafters sit this far above the wall top at the outside face, where the heel of the truss carries them.
  heel: 0.1,
  eaveOverhang: 0.5,
  rakeOverhang: 0.3,
  rafterDepth: 0.14,
  rafterWidth: 0.05,
  deckThickness: 0.03,
  underlaymentThickness: 0.01,
  // The near slope is cut back to here: the covering still shows over the kitchen, and the parts show in section at the cut.
  cutX: 2.4,
  // The ceiling and the attic floor are cut back to here, in section. Under a whole ceiling, any view high enough to show the
  // house on a tall canvas hides the back half of every room (the bed, the sofa, the wall unit); cut, the rooms read from
  // above and the insulation shows its depth at the cut.
  atticFrontZ: 0,
} as const

export const WALL_TOP_Y = HOUSE.floorY + HOUSE.wallHeight

// Metres above grade. A slab floor sits just above the lawn; a raised one clears the 18 in under the joists California's
// residential code asks for, plus the framing. Working numbers, tuned at the owner's review.
export const HOME_FLOOR_Y = { slab: 0.15, raised: 0.75 } as const
export const RAFTER_ORIGIN_Y = WALL_TOP_Y + HOUSE.heel
export const RIDGE_RISE = HOUSE.halfDepth * Math.tan(HOUSE.pitch)
export const RIDGE_Y = RAFTER_ORIGIN_Y + RIDGE_RISE
export const SLOPE_LENGTH = HOUSE.halfDepth / Math.cos(HOUSE.pitch)
export const EAVE_RUN = HOUSE.eaveOverhang / Math.cos(HOUSE.pitch)
export const COVERING_BASE = HOUSE.deckThickness + HOUSE.underlaymentThickness
export const GUTTER_Y = RAFTER_ORIGIN_Y - HOUSE.eaveOverhang * Math.tan(HOUSE.pitch) - ROOF_TRIM.gutter.drop
export const ROOF_HALF_LENGTH = HOUSE.halfLength + HOUSE.rakeOverhang
// In a slope's own frame, as the roof draws it.
export const RAFTER_PROFILE = rafterProfile(EAVE_RUN, SLOPE_LENGTH, HOUSE.rafterDepth, HOUSE.pitch)
// Plumb on a pitched roof, the fascia's outer top corner stands its thickness times the pitch's sine above the inner one;
// that corner meets the covering's base, so the fascia never shows through the first course laid over it.
export const FASCIA_CENTRE = eaveFasciaCentre(EAVE_RUN, HOUSE.pitch, ROOF_TRIM.fascia, COVERING_BASE - ROOF_TRIM.fascia.thickness * Math.sin(HOUSE.pitch))
// How far out from the wall line the gutter's back lip hangs, on the fascia's face.
export const GUTTER_BACK = HOUSE.eaveOverhang + ROOF_TRIM.fascia.thickness + ROOF_TRIM.gutter.standoff
// Where the covering's first course starts, in a slope's own frame: it laps this far past the gutter's back lip, the way
// shingles run out over a drip edge, so no gap shows between the roof and the gutter from above. A working number, tuned
// by eye.
const COVERING_LAP = 0.015
export const COVERING_EAVE_X = (COVERING_BASE * Math.sin(HOUSE.pitch) - GUTTER_BACK - COVERING_LAP) / Math.cos(HOUSE.pitch)

export const LOW_SLOPE = {
  joistSpace: 0.3,
  membraneThickness: 0.02,
  parapet: 0.45,
  coping: 0.05,
  // The coping overhangs the parapet's width by this much.
  copingOverhang: 0.05,
  // Rolled roofing goes down in strips this wide.
  seamSpacing: 0.9,
} as const

export const LOW_SLOPE_DECK_Y = WALL_TOP_Y + LOW_SLOPE.joistSpace
// How far a flat roof's joists stop short of the deck's underside and front face, which they would otherwise share a plane
// with. A working number: 3 mm is enough to clear the depth fight at the camera's farthest zoom, and too little to show.
export const JOIST_DECK_GAP = 0.003
export const PARAPET_TOP = LOW_SLOPE_DECK_Y + LOW_SLOPE.parapet
export const LOW_SLOPE_ROOF_Y = LOW_SLOPE_DECK_Y + HOUSE.deckThickness + LOW_SLOPE.membraneThickness

// Where the roof comes down toward the eaves a blanket stops this far under it, stepping down in this many bands. Working
// numbers, tuned by eye.
export const ATTIC_EAVE_INSULATION = { clearance: 0.015, steps: 3 } as const

// Depth of each insulation as laid, the tell being whether it covers the joist tops.
export const INSULATION_DEPTH: Readonly<Record<string, number>> = {
  'batts-r11': 0.09,
  'batts-r19': 0.16,
  'batts-r30': 0.24,
  'blown-r38': 0.31,
}
// What sits over the blanket clears the deepest of them, so a deeper material added later moves it too.
export const DEEPEST_INSULATION = Math.max(...Object.values(INSULATION_DEPTH))
// A pitched boot's top, where a hung run comes down into it.
export const REGISTER_BOOT_TOP = WALL_TOP_Y + DEEPEST_INSULATION + REGISTER_BOOT.clear

const INNER = HOUSE.halfLength - HOUSE.wallThickness
export const BACK_INNER = -HOUSE.halfDepth + HOUSE.wallThickness
// The back wall's stucco stops a paint thickness short of its inside face, so the side walls' stucco starts there to meet it
// and no slit shows at the back corners.
export const SIDE_SKIN_FROM = BACK_INNER - HOUSE.paintThickness

export const ATTIC_JOIST_XS = framingGrid(-INNER + HOUSE.joistWidth, INNER - HOUSE.joistWidth, HOUSE.framingSpacing)
// The open joists and batts stop this far behind the cut. A blown blanket's cut face lies right on it with rounded edges, so
// joist ends flush with that face speckle through it and peek out under its rounding. A working number, tuned by eye.
const ATTIC_CUT_SETBACK = 0.03
// Partly open cuts the attic floor back with the ceiling; the Complete house carries it on to the front wall.
export const ATTIC_SPANS = {
  open: { from: BACK_INNER, to: HOUSE.atticFrontZ - ATTIC_CUT_SETBACK },
  complete: { from: HOUSE.atticFrontZ, to: HOUSE.halfDepth - HOUSE.wallThickness },
} as const

export const PARTITIONS_X = [-2, HOUSE.cutX] as const

export const ROOMS = {
  bedroom: { from: -INNER, to: PARTITIONS_X[0], paint: '#e3e4d3', floor: '#c39a6e' },
  living: { from: PARTITIONS_X[0], to: PARTITIONS_X[1], paint: '#f0e4d0', floor: '#c39a6e' },
  kitchen: { from: PARTITIONS_X[1], to: INNER, paint: '#f2ebdd', floor: '#ddd3c1' },
} as const satisfies Record<string, RoomSpan>

// In the front wall, at the head of the walk. Working numbers, tuned by eye.
export const FRONT_DOOR: WallOpening = { along: -0.6, width: 0.95, sill: 0, head: 2.1 }

// Metres: the jamb's width and depth, and the shut leaf's thickness and how far it hangs in from the wall's outside face.
// Working numbers, tuned at the owner's review.
export const FRONT_DOOR_FRAME = { jamb: 0.06, depth: 0.12, leaf: 0.045, inset: 0.03 } as const

// Doorways sit toward the back so the cut front of each partition reads as a clean wall end.
export const PARTITION_DOOR = { along: -1.1, width: 0.9, sill: 0, head: 2.05 } as const

export const HOUSE_WALLS = {
  back: {
    run: 'x',
    line: -HOUSE.halfDepth + HOUSE.wallThickness / 2,
    outward: -1,
    from: -HOUSE.halfLength,
    to: HOUSE.halfLength,
    openings: [
      { along: -4, width: 1.4, sill: 0.95, head: 2.15 },
      { along: 0.2, width: 1.8, sill: 1.15, head: 2.15 },
      { along: 4.2, width: 1.1, sill: 1.2, head: 2.15 },
    ],
  },
  left: {
    run: 'z',
    line: -HOUSE.halfLength + HOUSE.wallThickness / 2,
    outward: -1,
    from: BACK_INNER,
    to: HOUSE.halfDepth,
    openings: [{ along: 0.4, width: 1.2, sill: 0.95, head: 2.15 }],
  },
  right: {
    run: 'z',
    line: HOUSE.halfLength - HOUSE.wallThickness / 2,
    outward: 1,
    from: BACK_INNER,
    to: HOUSE.halfDepth,
    openings: [{ along: 0.6, width: 0.9, sill: 1.2, head: 2.15 }],
  },
} as const satisfies Record<string, HouseWall>

// The partitions, the floors and the side rooms' paint all end at z = `halfDepth`, the cut face Partly open shows. A front
// wall whose outer face sat on that plane would flicker against their end faces, so it stands this far proud.
export const FRONT_WALL_PROUD = 0.003

// Only the Complete house draws it; it stays out of `HOUSE_WALLS`, so Partly open and the rooms' paint never see it.
export const FRONT_WALL: HouseWall = {
  run: 'x',
  line: HOUSE.halfDepth - HOUSE.wallThickness / 2 + FRONT_WALL_PROUD,
  outward: 1,
  from: -HOUSE.halfLength + HOUSE.wallThickness,
  to: HOUSE.halfLength - HOUSE.wallThickness,
  // Working numbers, tuned by eye.
  openings: [
    { along: -4, width: 1.4, sill: 0.95, head: 2.15 },
    { along: 1.3, width: 1.2, sill: 0.95, head: 2.15 },
  ],
}

// The door is not one of the front wall's own openings, so the windows' frames never draw round it.
export const FRONT_OPENINGS: readonly WallOpening[] = [...FRONT_WALL.openings, FRONT_DOOR]

// The side walls end at the cut face, short of the proud front wall and with a strip of room paint between their stucco and
// its end. The Complete house closes each front corner with the side skin carried out to the front wall's face, and a box over
// that strip.
const CORNER_SKIN = HOUSE.wallThickness - HOUSE.paintThickness
const CORNER_BOTTOM = HOUSE.floorY - HOUSE.floorThickness
const CORNER_HEIGHT = WALL_TOP_Y - CORNER_BOTTOM
const CORNER_Z = HOUSE.halfDepth + FRONT_WALL_PROUD / 2
export const FRONT_CORNERS: BoxSpec[] = [-1, 1].flatMap(side => [
  { size: [CORNER_SKIN, CORNER_HEIGHT, FRONT_WALL_PROUD], position: [side * (HOUSE.halfLength - CORNER_SKIN / 2), CORNER_BOTTOM + CORNER_HEIGHT / 2, CORNER_Z] },
  { size: [HOUSE.paintThickness, CORNER_HEIGHT, FRONT_WALL_PROUD], position: [side * (HOUSE.halfLength - CORNER_SKIN - HOUSE.paintThickness / 2), CORNER_BOTTOM + CORNER_HEIGHT / 2, CORNER_Z] },
] as BoxSpec[])

// The height of each gable vent's centre: the vent itself, the fan behind the left one and the heat it blows out all sit here.
export const GABLE_VENT_Y = WALL_TOP_Y + GABLE_VENT.rise

// Behind the left gable's vent, its blowing face against the vent's inner slats, blowing out through the gable: its own +z turns to
// the world's −x. Partly open opens the attic over it; from the opening view the gable hides it, so it shows once the camera
// comes round to the front-right.
export const ATTIC_FAN_SPOT = {
  position: [-HOUSE.halfLength + HOUSE.wallThickness + GABLE_VENT.proud + ATTIC_FAN_LOOK.depth / 2, GABLE_VENT_Y, 0],
  rotationY: -Math.PI / 2,
} as const

// Metres the Complete house's cut-away parts rise as they fade, so the opening reads as the front rising off. A working
// number, tuned at the owner's review.
export const HOME_OPENING_RISE = 0.3

// Single glazing reads as a slim frame, double glazing as a deep frame holding two panes.
export const WINDOW_FRAMES = {
  single: { bar: 0.045, depth: 0.07, panes: 1 },
  double: { bar: 0.075, depth: 0.12, panes: 2 },
} as const

export const EQUIPMENT = {
  condenser: { position: [-7.25, 0, -2.1] as const, pad: [1.0, 0.08, 1.3] as const },
  meter: { position: [-HOUSE.halfLength - 0.02, HOUSE.floorY + 1.15, 2.7] as const },
  thermostat: { position: [1.85, HOUSE.floorY + 1.45, BACK_INNER + HOUSE.paintThickness] as const },
  // Both sit in the bedroom's back wall, facing the open front, so the opening view looks straight at them.
  // Through the wall beside the bed: [width, height, depth through the wall], and how far it stands out behind the house.
  wallUnit: { x: -2.6, y: HOUSE.floorY + 1.2, size: [0.68, 0.4, 0.5] as const, outside: 0.1 },
  // On the sill of the bedroom's back window, in its left pane clear of the mullion.
  // Most of the box hangs outside, the way a window unit sits on the sill with its condenser behind the house; `inside` of it
  // stands in from the wall's centre line.
  windowUnit: { x: -4.34, size: [0.6, 0.42, 0.6] as const, inside: 0.24 },
  // Toward the ridge, where the attic has the headroom for it under the rafters, standing just clear of the joists.
  plenum: { position: [-0.6, WALL_TOP_Y + 0.385, -1.55] as const, size: [0.7, 0.45, 0.7] as const },
  ductRadius: 0.11,
  // Duct runs from the plenum to a register over each room, each ending in a joist bay, where its boot comes through.
  ductRuns: [
    [[-0.95, WALL_TOP_Y + 0.38, -1.5], [-2.4, WALL_TOP_Y + 0.37, -1.3], [-4.23, WALL_TOP_Y + 0.36, -0.5]],
    [[-0.25, WALL_TOP_Y + 0.38, -1.4], [0.1, WALL_TOP_Y + 0.37, -1], [0.44, WALL_TOP_Y + 0.36, -0.5]],
    [[-0.25, WALL_TOP_Y + 0.4, -1.75], [2, WALL_TOP_Y + 0.38, -2], [4.17, WALL_TOP_Y + 0.36, -0.6]],
  ] as const,
} as const

// Every hole through the ceiling: a boot at each run's end, a recessed light's can in each room, and the two plumbing vents,
// the kitchen sink's and the bath stack's. Each stands in a joist bay, clear of its foam collar, and behind the cut line.
// Both pipes leave through the back slope, between two rafters: Partly open takes the front slope off over the bedroom.
// Working positions, tuned by eye.
export const CEILING_OPENINGS: readonly CeilingOpening[] = [
  ...EQUIPMENT.ductRuns.map((run): CeilingOpening => {
    const [x, , z] = run[run.length - 1]
    return { kind: 'boot', at: [x, z], radius: REGISTER_BOOT.size / 2 }
  }),
  { kind: 'can', at: [-4.4, -2.2], radius: 0.09 },
  { kind: 'can', at: [1.2, -2.3], radius: 0.09 },
  { kind: 'can', at: [3.4, -2.2], radius: 0.09 },
  { kind: 'pipe', at: [4.6, -1.3], radius: 0.04 },
  { kind: 'pipe', at: [-3.15, -2.7], radius: 0.04 },
]

// Each downspout's [x, z] and its width, by roof form: a gable's at its back corners, a flat roof's two scuppers at the back.
// The garage stands at the right front corner.
export const DOWNSPOUTS = {
  pitched: {
    size: 0.08,
    at: [
      [-HOUSE.halfLength + 0.3, -HOUSE.halfDepth - 0.08],
      [HOUSE.halfLength - 0.3, -HOUSE.halfDepth - 0.08],
    ],
  },
  lowSlope: {
    size: 0.09,
    at: [
      [-3.5, -HOUSE.halfDepth - 0.09],
      [3.5, -HOUSE.halfDepth - 0.09],
    ],
  },
} as const satisfies Record<'pitched' | 'lowSlope', { size: number, at: readonly (readonly [number, number])[] }>

export const CRAWL_VENTS_X = [-4.5, -1.5, 1.5, 4.5] as const
export const CRAWL_VENTS_Z = [-2, 1.5] as const

const UNDER_FLOOR = HOUSE.floorY - HOUSE.floorThickness
const { joistDepth: JOIST_DEPTH, girderDepth: GIRDER_DEPTH } = FOUNDATION

// Raised: a vented perimeter skirt around an open crawl space, drawn in the ground group for the house's own floor. The front
// one is the Complete house's alone.
export const CRAWL_SKIRT_BOXES: readonly BoxSpec[] = [
  { size: [HOUSE.halfLength * 2, UNDER_FLOOR, HOUSE.wallThickness], position: [0, UNDER_FLOOR / 2, -HOUSE.halfDepth + HOUSE.wallThickness / 2] },
  { size: [HOUSE.wallThickness, UNDER_FLOOR, HOUSE.halfDepth * 2 - HOUSE.wallThickness * 2], position: [-HOUSE.halfLength + HOUSE.wallThickness / 2, UNDER_FLOOR / 2, 0] },
  { size: [HOUSE.wallThickness, UNDER_FLOOR, HOUSE.halfDepth * 2 - HOUSE.wallThickness * 2], position: [HOUSE.halfLength - HOUSE.wallThickness / 2, UNDER_FLOOR / 2, 0] },
]
export const FRONT_CRAWL_SKIRT_BOXES: readonly BoxSpec[] = [{ size: [HOUSE.halfLength * 2, UNDER_FLOOR, HOUSE.wallThickness], position: [0, UNDER_FLOOR / 2, HOUSE.halfDepth - HOUSE.wallThickness / 2] }]

// The vents hang under the floor at a fixed depth, not in the stretching ground group, so they keep their size on either floor.
export const CRAWL_VENT_Y = UNDER_FLOOR * 0.55
const { vent: VENT } = FOUNDATION
export const CRAWL_VENT_BOXES: readonly BoxSpec[] = [
  ...CRAWL_VENTS_X.map(x => ({ size: [VENT.long, VENT.high, VENT.proud], position: [x, CRAWL_VENT_Y, -HOUSE.halfDepth - VENT.proud / 2] }) as BoxSpec),
  ...CRAWL_VENTS_Z.flatMap(z => [-1, 1].map(side => ({ size: [VENT.proud, VENT.high, VENT.long], position: [side * (HOUSE.halfLength + VENT.proud / 2), CRAWL_VENT_Y, z] }) as BoxSpec)),
]
export const FRONT_CRAWL_VENT_BOXES: readonly BoxSpec[] = CRAWL_VENTS_X.map(x => ({ size: [VENT.long, VENT.high, VENT.proud], position: [x, CRAWL_VENT_Y, HOUSE.halfDepth + VENT.proud / 2] }))

// Hung at fixed depths under the floor, so they ride with it on either foundation. Every beam stops at the skirt's inner
// faces: an end in the plane of a skirt's face would show through it.
export const FLOOR_FRAMING: readonly BoxSpec[] = [
  ...framingGrid(-HOUSE.halfLength + HOUSE.wallThickness + FOUNDATION.joistInset, HOUSE.halfLength - HOUSE.wallThickness - FOUNDATION.joistInset, HOUSE.framingSpacing).map(x => ({
    size: [HOUSE.joistWidth, JOIST_DEPTH, HOUSE.halfDepth * 2 - HOUSE.wallThickness * 2],
    position: [x, UNDER_FLOOR - JOIST_DEPTH / 2, 0],
  }) as BoxSpec),
  ...FOUNDATION.girdersZ.map(z => ({
    size: [HOUSE.halfLength * 2 - HOUSE.wallThickness * 2, GIRDER_DEPTH, FOUNDATION.girderWidth],
    position: [0, UNDER_FLOOR - JOIST_DEPTH - GIRDER_DEPTH / 2, z],
  }) as BoxSpec),
]

// Each pier hangs from its girder, sized for the raised floor, so it meets the girder at every height and stands on grade
// once the house is up. Scaled with the ground instead, it would stop short of the girders.
const GIRDER_BOTTOM = UNDER_FLOOR - JOIST_DEPTH - GIRDER_DEPTH
const PIER_HEIGHT = HOME_FLOOR_Y.raised - HOUSE.floorThickness - JOIST_DEPTH - GIRDER_DEPTH
export const PIERS: readonly BoxSpec[] = FOUNDATION.girdersZ.flatMap(z => FOUNDATION.piersX.map(x => ({
  size: [FOUNDATION.pierWidth, PIER_HEIGHT, FOUNDATION.pierWidth],
  position: [x, GIRDER_BOTTOM - PIER_HEIGHT / 2, z],
}) as BoxSpec))

// The opening view: the whole house, the garage beside it and the open front, from the front-left. The camera rig keeps a
// 4:3 width of whatever part of the scene is visible, so each view is centred on the house and the garage together (x −6.3
// to 12.7, the garage's rake included) and fills about 92% of that width: beside an open card the pair still runs edge to
// edge without going under it. The span is written out in metres: the lot reads this file, so this file cannot read the lot.
// Wide stages look low and nearly square-on, under the ceiling into the rooms; tall ones look higher and more corner-on, so
// the depth of the house fills the extra height. A wider lens keeps each well inside the orbit's reach, so the first touch
// never clamps the camera and the view never jumps. Working numbers, tuned by eye.
export const HOME_FRAMINGS = {
  wide: { position: [-7, 7.4, 26.6], target: [3.4, 1.4, 0.2], fov: 34 },
  tall: { position: [-8.2, 10, 25.7], target: [3.2, 1.3, 0.2], fov: 34 },
} as const satisfies Record<string, CameraFraming>

export const TALL_BELOW_ASPECT = 1

// 1.53 rad (about 87.7 degrees) sits just above the horizon: the camera nears eye level without ever dipping under the ground.
export const HOME_ORBIT = { minDistance: 3, maxDistance: 36, maxPolarAngle: 1.53 } as const

// The sky dome is centred on the origin, so a fully zoomed-out camera sees its far wall at dome radius plus orbit distance.
// The margin keeps the dome off the far plane as the orbit target drifts from the origin.
const CAMERA_FAR_MARGIN = 20
export const HOME_CAMERA_FAR = SKY_RIG.domeRadius + HOME_ORBIT.maxDistance + CAMERA_FAR_MARGIN

export const HOME_GHOST_OPACITY = 0.15

// The rep pans the point the camera turns around inside the house's and the garage's footprint plus a margin, out to the
// sidewalk in front, and from the ground to just above the ridge, so a pan never loses the house. A double-tap ends the
// camera at most doubleTapDistance from the spot it looks at; a camera already nearer keeps its distance.
export const HOME_PAN = {
  margin: 3,
  aboveRidge: 1,
  doubleTapDistance: 9,
} as const
