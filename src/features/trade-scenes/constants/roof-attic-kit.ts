import type { ShakeCourse, ShingleCourse, TileCourse } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { COVERING_COLORS, HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'

type Vec3 = readonly [number, number, number]

// Section scale, in metres, in the kit's own frame: x runs across the span (the front slope at −x), y is up from the
// ceiling's top face, z runs along the ridge. Sized to fill the roof anchor's framing with the parts peeled; thin parts are
// thickened past true size so each still reads at that distance.
export const PITCHED_KIT = {
  halfSpan: 2,
  // Steeper than the house's 4:12 so the attic has room to open up between the parts.
  pitch: Math.atan(6 / 12),
  depth: 2,
  overhang: 0.3,
  wall: { height: 0.55, thickness: 0.12 },
  joistDepth: 0.14,
  joistWidth: 0.045,
  framingSpacing: 0.4,
  rafterDepth: 0.14,
  rafterWidth: 0.045,
  drywall: 0.022,
  deck: 0.03,
  membrane: 0.008,
  foil: 0.005,
  iceWaterReach: 0.55,
  fascia: { height: 0.16, thickness: 0.025 },
  ridgeBoard: { height: 0.2, thickness: 0.035 },
  // The cap stands `slot` off the peak, leaving the gap along the ridge that hot air leaves through.
  ridgeVent: { run: 0.2, thickness: 0.035, slot: 0.025 },
} as const

export const PITCHED_SLOPE_LENGTH = PITCHED_KIT.halfSpan / Math.cos(PITCHED_KIT.pitch)
// Both sides of the gable share one drawing; each lays its covering from its own seed so the two never match piece for piece.
export const KIT_SLOPE_FACES = ['front', 'back'] as const
export type KitSlopeFace = typeof KIT_SLOPE_FACES[number]
export const KIT_SLOPE_SEEDS = { front: 7, back: 19 } as const satisfies Record<KitSlopeFace, number>
export const PITCHED_COVERING_BASE = PITCHED_KIT.deck + PITCHED_KIT.membrane * 2

// A low-slope roof: the joists carry the deck, the ceiling hangs right under them, and a parapet rises at the back.
export const LOW_SLOPE_KIT = {
  halfSpan: 2,
  depth: 2,
  overhang: 0.15,
  wall: { height: 0.55, thickness: 0.12 },
  joistDepth: 0.24,
  joistWidth: 0.045,
  framingSpacing: 0.4,
  drywall: 0.022,
  deck: 0.03,
  membrane: 0.008,
  capSheet: 0.014,
  foil: 0.005,
  rollWidth: 0.9,
  lapBead: 0.005,
  // How far the cap sheet turns up the parapet's face.
  flashing: 0.24,
  parapet: { height: 0.42, coping: 0.04 },
  fascia: 0.025,
  iceWaterReach: 0.5,
} as const

export const LOW_SLOPE_COVERING_BASE = LOW_SLOPE_KIT.joistDepth + LOW_SLOPE_KIT.deck + LOW_SLOPE_KIT.membrane
export const LOW_SLOPE_ROOF_TOP = LOW_SLOPE_COVERING_BASE + LOW_SLOPE_KIT.capSheet

// Near true size at this scale: a 5 in exposure, foot-wide tabs, 17 in barrel tile, 24 in shakes with a 7 in exposure.
export const KIT_SHINGLE = { exposure: 0.11, length: 0.2, tab: 0.28, gap: 0.008, thickness: 0.016 } as const satisfies ShingleCourse
// New shingles are laminated architectural ones, laid with uneven tab widths.
export const KIT_ARCHITECTURAL_SHINGLE = { ...KIT_SHINGLE, thickness: 0.02, tabJitter: 0.6 } as const satisfies ShingleCourse
export const KIT_TILE = { exposure: 0.22, length: 0.3, radius: 0.065 } as const satisfies TileCourse
export const KIT_SHAKE = { exposure: 0.17, length: 0.42, minWidth: 0.08, maxWidth: 0.22, gap: 0.01, thickness: 0.03, splitShare: 0.22, splitGap: 0.012 } as const satisfies ShakeCourse
// A shake is split from a bolt, thick at the butt and thin where the next course covers it.
export const KIT_SHAKE_TIP = 0.007
export const KIT_SPACED_BOARD = { width: 0.14, gap: 0.12, thickness: 0.022 } as const
export const KIT_BATT = { length: 1.0, gap: 0.014, missingShare: 0.1 } as const
// Under a pitched roof the batts stop short of the eaves, where the rafters come down to meet the wall.
export const KIT_BATT_EAVE_CLEARANCE = 0.3
// Blown fill's surface resolution: enough segments for the lumps to read, few enough for an iPad.
export const KIT_BLANKET_SEGMENTS = { x: 90, z: 46 } as const
export const KIT_BLOWN_INSULATION = 'blown-r38'
// The flat roof's coverings; every other covering is laid on the gable's slopes.
export const KIT_FLAT_COVERINGS: readonly string[] = ['membrane', 'cool-membrane']
// Granules read as grit at roughly this many texture repeats per metre.
export const KIT_GRIT_REPEAT = 1.6
export const KIT_FOIL_LOOK = { roughness: 0.3, metalness: 0.75 } as const
export const KIT_BLISTER = { radius: 0.045, height: 0.012, count: 14 } as const
export const KIT_GUTTER = { width: 0.12, height: 0.1, wall: 0.008, sag: 0.05 } as const
export const KIT_DRIP_EDGE = { flange: 0.07, leg: 0.07, thickness: 0.006 } as const

// The ceiling's penetrations, the gaps air sealing closes: a recessed light's can and a vent pipe, [x, z] in the kit.
export const KIT_PENETRATIONS = {
  light: { at: [-0.55, -0.7] as const, radius: 0.08, height: 0.13 },
  // Under a pitched roof the pipe rises into the attic; under a flat one it stops below the deck.
  pipe: { at: [0.75, -0.25] as const, radius: 0.025, height: { 'pitched': 0.5, 'low-slope': LOW_SLOPE_KIT.joistDepth - 0.02 } },
  collar: { reach: 0.03, height: 0.03 },
} as const

// Insulation as laid, matching the home's depths: the tell is whether it covers the joist tops.
export const KIT_INSULATION_DEPTH: Readonly<Record<string, number>> = {
  'batts-r11': 0.09,
  'batts-r19': 0.16,
  'batts-r30': 0.24,
  'blown-r38': 0.31,
}

// Physical colours under scene light, shared with the home so the zoomed parts match the house they came from.
export const KIT_COLORS = {
  lumber: HOME_PALETTE.lumber,
  plywood: HOME_PALETTE.plywood,
  plywoodWorn: HOME_PALETTE.plywoodWorn,
  boards: HOME_PALETTE.boardsWorn,
  drywall: HOME_PALETTE.ceiling,
  wall: HOME_PALETTE.stucco,
  trim: HOME_PALETTE.trim,
  felt: HOME_PALETTE.felt,
  feltWorn: '#45403a',
  synthetic: HOME_PALETTE.synthetic,
  iceWater: '#1f2a36',
  foil: HOME_PALETTE.foil,
  metal: '#d5dde4',
  metalWorn: '#a9aba6',
  ridgeVent: HOME_PALETTE.ridgeVent,
  gutter: HOME_PALETTE.gutter,
  gutterWorn: HOME_PALETTE.gutterWorn,
  insulationWorn: HOME_PALETTE.insulationWorn,
  insulationNew: HOME_PALETTE.insulationNew,
  foam: '#e9d27c',
  lightCan: '#bfc3c4',
  pipe: '#e8e4dc',
  blister: '#4a4540',
  coping: HOME_PALETTE.trim,
} as const

// The flat cap sheet is granulated: darker and gritty, and a cool one white. The rest follow the home's covering colours.
export const KIT_COVERING_COLORS: Readonly<Record<string, { worn: string, new: string }>> = {
  ...COVERING_COLORS,
  'shingle': { worn: '#6b645d', new: '#3f444b' },
  // Weathered cedar goes silver-grey with brown left in it; asphalt never has that grain of warm and cool.
  'wood-shake': { worn: '#857b70', new: '#b4834f' },
  'membrane': { worn: '#57524c', new: '#3e3c3a' },
  'cool-membrane': { worn: '#d8d6cf', new: '#f2f1ec' },
}

// Where the kit sits: this point of the kit lands on the home's roof anchor, and the kit turns so its front slope faces the
// home's front, the slope it stands in for.
export const KIT_ROTATION_Y = Math.PI / 2
export const KIT_FOCUS: Record<RoofForm, Vec3> = {
  // Above the roof's middle, so a fully peeled gable keeps headroom under the top of a wide canvas.
  'pitched': [0, 0.8, 0],
  'low-slope': [0, 0.22, 0],
}

const PITCHED_ROOF_LIFT = 0.42
const LOW_SLOPE_ROOF_LIFT = 0.36

// Each part's offset at full peel, in the kit's frame. The roof lifts off the attic and its parts separate upward from the
// rafters out to the covering; the ceiling drops away and the insulation rises off it; the edge metal swings out from the eave.
export const KIT_PEEL: Record<RoofForm, Readonly<Record<string, Vec3>>> = {
  'pitched': {
    'ceiling': [0, -0.32, 0],
    'air-sealing': [0, -0.16, 0],
    'attic-insulation': [0, 0.1, 0],
    'rafters': [0, PITCHED_ROOF_LIFT, 0],
    'radiant-barrier': [0, PITCHED_ROOF_LIFT - 0.14, 0],
    'deck': [0, PITCHED_ROOF_LIFT + 0.16, 0],
    'ice-and-water': [0, PITCHED_ROOF_LIFT + 0.3, 0],
    'underlayment': [0, PITCHED_ROOF_LIFT + 0.42, 0],
    'drip-edge': [-0.14, PITCHED_ROOF_LIFT + 0.52, 0],
    'covering': [0, PITCHED_ROOF_LIFT + 0.68, 0],
    'ridge-vent': [0, PITCHED_ROOF_LIFT + 0.9, 0],
    'gutter': [-0.3, PITCHED_ROOF_LIFT - 0.1, 0],
  },
  'low-slope': {
    'ceiling': [0, -0.3, 0],
    'air-sealing': [0, -0.15, 0],
    'attic-insulation': [0, 0.06, 0],
    'rafters': [0, LOW_SLOPE_ROOF_LIFT, 0],
    'radiant-barrier': [0, LOW_SLOPE_ROOF_LIFT + 0.07, 0],
    'deck': [0, LOW_SLOPE_ROOF_LIFT + 0.18, 0],
    'ice-and-water': [0, LOW_SLOPE_ROOF_LIFT + 0.28, 0],
    'underlayment': [0, LOW_SLOPE_ROOF_LIFT + 0.38, 0],
    'drip-edge': [-0.14, LOW_SLOPE_ROOF_LIFT + 0.48, 0],
    'covering': [0, LOW_SLOPE_ROOF_LIFT + 0.6, 0],
    'gutter': [-0.3, LOW_SLOPE_ROOF_LIFT - 0.1, 0],
  },
}

// Each pin on the end of the section facing the camera, spread along the span so no two stack. A slope part's spot is
// [distance up the slope from the wall line, height off the rafters' top]; the rest are points in the kit's frame.
export const KIT_PIN_Z = -PITCHED_KIT.depth / 2
export const PITCHED_PIN_SLOPE_SPOTS: Readonly<Record<string, readonly [number, number]>> = {
  'rafters': [1.95, -PITCHED_KIT.rafterDepth / 2],
  'radiant-barrier': [1.45, -PITCHED_KIT.rafterDepth - PITCHED_KIT.foil],
  'deck': [1.5, PITCHED_KIT.deck / 2],
  'ice-and-water': [0.1, PITCHED_KIT.deck + PITCHED_KIT.membrane],
  'underlayment': [1.0, PITCHED_COVERING_BASE],
  'drip-edge': [-PITCHED_KIT.overhang + 0.02, PITCHED_COVERING_BASE],
  'covering': [0.5, PITCHED_COVERING_BASE + 0.03],
}
export const PITCHED_PIN_POINTS: Readonly<Record<string, Vec3>> = {
  'ceiling': [0.9, -PITCHED_KIT.drywall / 2, KIT_PIN_Z],
  'attic-insulation': [-0.45, 0, KIT_PIN_Z],
}
export const LOW_SLOPE_PIN_POINTS: Readonly<Record<string, Vec3>> = {
  'ceiling': [0.9, -LOW_SLOPE_KIT.drywall / 2, KIT_PIN_Z],
  'attic-insulation': [-0.45, 0, KIT_PIN_Z],
  'rafters': [0.95, LOW_SLOPE_KIT.joistDepth / 2, KIT_PIN_Z],
  'radiant-barrier': [0.3, LOW_SLOPE_KIT.joistDepth - LOW_SLOPE_KIT.foil, KIT_PIN_Z],
  'deck': [1.35, LOW_SLOPE_KIT.joistDepth + LOW_SLOPE_KIT.deck / 2, KIT_PIN_Z],
  'ice-and-water': [-LOW_SLOPE_KIT.halfSpan + 0.1, LOW_SLOPE_KIT.joistDepth + LOW_SLOPE_KIT.deck + LOW_SLOPE_KIT.membrane, KIT_PIN_Z],
  'underlayment': [0.6, LOW_SLOPE_COVERING_BASE, KIT_PIN_Z],
  'drip-edge': [-LOW_SLOPE_KIT.halfSpan - LOW_SLOPE_KIT.overhang, LOW_SLOPE_COVERING_BASE, KIT_PIN_Z],
  'covering': [-0.3, LOW_SLOPE_ROOF_TOP + 0.01, KIT_PIN_Z],
}
