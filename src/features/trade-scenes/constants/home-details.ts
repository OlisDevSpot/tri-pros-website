import type { DuctMaterial } from '@/shared/modules/construction/core/constants/enums'

// Metres. The small parts the house is dressed in, beside the shell's own dimensions in home-geometry.

// The gable's K-style gutter cut across: a flat back against the fascia, a flat bottom, a cove and ogee front, and a lip rolled out
// over the open top, from a sheet 3 mm thick. In metres, as (out, up) about the run's centre line, `size` wide. `outline` is the
// sheet's section, counter-clockwise; `cap` the end plate, the outer face shut across the top at the back's height; `front` the
// first and last of the outline's points on the outer front face, the face the street sees. A streak's colour blends across a
// strip, so the face's two edges each take a point 1 mm off it, and a streak stops there rather than fading over the bottom or
// the lip. A working number, set by shot.
const GUTTER_PROFILE = {
  outline: [
    [-0.065, 0.0514],
    [-0.065, -0.0599],
    [0.0191, -0.0599],
    [0.0201, -0.0599],
    [0.0282, -0.0588],
    [0.0343, -0.0551],
    [0.0379, -0.0491],
    [0.0391, -0.041],
    [0.0391, -0.0278],
    [0.0402, -0.0201],
    [0.0436, -0.014],
    [0.0495, -0.009],
    [0.0559, -0.0035],
    [0.0598, 0.0043],
    [0.061, 0.014],
    [0.061, 0.0295],
    [0.0605, 0.0348],
    [0.0586, 0.0391],
    [0.0555, 0.0422],
    [0.0523, 0.0436],
    [0.0523, 0.0513],
    [0.0527, 0.0545],
    [0.0539, 0.0562],
    [0.0559, 0.0569],
    [0.0589, 0.0566],
    [0.0629, 0.0526],
    [0.0636, 0.0533],
    [0.065, 0.0547],
    [0.0602, 0.0594],
    [0.0555, 0.0599],
    [0.052, 0.0587],
    [0.0499, 0.0557],
    [0.0493, 0.0515],
    [0.0493, 0.0416],
    [0.0537, 0.0397],
    [0.0561, 0.0374],
    [0.0575, 0.034],
    [0.058, 0.0294],
    [0.058, 0.0142],
    [0.0569, 0.0052],
    [0.0535, -0.0016],
    [0.0476, -0.0068],
    [0.0413, -0.0121],
    [0.0374, -0.0191],
    [0.0361, -0.0276],
    [0.0361, -0.0408],
    [0.035, -0.048],
    [0.0321, -0.053],
    [0.0272, -0.0559],
    [0.0199, -0.0569],
    [-0.062, -0.0569],
    [-0.062, 0.0514],
  ],
  cap: [
    [-0.065, 0.0514],
    [-0.065, -0.0599],
    [0.0201, -0.0599],
    [0.0282, -0.0588],
    [0.0343, -0.0551],
    [0.0379, -0.0491],
    [0.0391, -0.041],
    [0.0391, -0.0278],
    [0.0402, -0.0201],
    [0.0436, -0.014],
    [0.0495, -0.009],
    [0.0559, -0.0035],
    [0.0598, 0.0043],
    [0.061, 0.014],
    [0.061, 0.0295],
    [0.0605, 0.0348],
    [0.0586, 0.0391],
    [0.0555, 0.0422],
    [0.0523, 0.0436],
    [0.0523, 0.0513],
  ],
  front: [3, 25],
} as const

export const ROOF_TRIM = {
  // The spaced boards an older gable is sheathed with.
  board: { width: 0.14, gap: 0.1, thickness: 0.024 },
  fascia: { height: 0.2, thickness: 0.035 },
  // The rake's top stands `proud` above the deck, so a drip edge on the rake caps it there.
  rake: { height: 0.16, thickness: 0.035, proud: 0.03 },
  // The metal's gauge, its flange up the deck and its lip down the trim's face. Working numbers, set by eye.
  dripEdge: { sheet: 0.004, flange: 0.07, lip: 0.05 },
  // The gable's gutter: its section, the gap it hangs off the fascia by and how far below the eave it sits. The gap takes a
  // drip edge's lip laid over a replaced fascia board, with room to spare so the lip and the gutter's back never fight.
  gutter: { size: 0.13, standoff: 0.01, drop: 0.05, station: 0.1, hangerSpacing: 0.6, profile: GUTTER_PROFILE },
} as const

export const FOUNDATION = {
  // Set back a little under the stucco, the way the slab edge sits below the weep screed, and so the two faces never fight.
  slabSetback: 0.015,
  vent: { long: 0.38, high: 0.13, proud: 0.012 },
  crawlGround: { thickness: 0.02, y: 0.012 },
  // The floor joists stand clear of the skirt by this much at each end.
  joistInset: 0.1,
  joistDepth: 0.2,
  girderDepth: 0.1,
  girderWidth: 0.1,
  // Girders run along x at these z; a pier stands under each at these x.
  girdersZ: [-2, 0.6, 3],
  piersX: [-4, -1.3, 1.3, 4],
  pierWidth: 0.24,
} as const

// A louvred vent high in each gable, `rise` from the wall top to its centre, set as proud of the stucco as a crawl vent.
// It sits above the band the gable cracks start in, so none runs under it. Working numbers, tuned by eye.
export const GABLE_VENT = { width: 0.7, height: 0.45, rise: 0.85, frame: 0.05, slats: 5, slat: 0.035, proud: FOUNDATION.vent.proud } as const

// Up to a raised floor's front door: as many risers as keep each under 7 3/4 in, and the stair's width across the walk.
// Working numbers, tuned at the owner's review.
export const FRONT_STEPS = { risers: 4, tread: 0.28, width: 1.3 } as const

// A slab home's front door opens onto a stoop, one step up from the walk; a raised home's steps stand in its place.
export const FRONT_STOOP = { width: 1.9, depth: 0.9, height: 0.14 } as const

// A worn flat roof's blisters and patched spots, where water has sat: [x, z, size].
export const FLAT_ROOF_PATCHES = [
  [-4.2, -2.6, 0.9],
  [-1.1, -1.2, 0.6],
  [1.7, -3, 1.1],
  [3.6, 1.6, 0.8],
  [4.8, -0.6, 0.5],
  [-3, -0.6, 0.7],
] as const

// [width, height, depth] off the wall.
export const THERMOSTAT_BOX = {
  body: [0.13, 0.13, 0.03],
  face: [0.08, 0.05, 0.004],
  // The face sits this far above the body's centre, and the lit display just proud of it.
  faceRaise: 0.015,
  displayProud: 0.0005,
} as const

export const METER_BOX = {
  // The base plate: depth off the wall, height, width.
  base: [0.1, 0.46, 0.32],
  conduit: 0.04,
  // The conduit stands this far off the wall.
  conduitOffset: 0.03,
  dome: { radius: 0.1, depth: 0.09, raise: 0.04 },
} as const

// The insulated line set runs from the condenser into the wall at knee height, leaving the unit this far in from its pad's edge.
export const CONDENSER_LINE_SET = { y: 0.42, inset: 0.15, size: 0.05, z: 0.32 } as const

// Under a flat roof the runs squeeze into the joist space, this far lower and this share of its depth across.
export const LOW_SLOPE_DUCTS = { drop: 0.24, radiusShare: 0.25 } as const

// Ducts put in to current code hang from the rafters on straps, clear of the insulation; older ones lie on the joists.
export const HUNG_DUCT_MATERIALS = ['r6-silver-flex', 'r8-flex'] as const satisfies readonly DuctMaterial[]

// Working numbers, tuned by eye. A pitched roof's boot stands on the ceiling to `clear` over the deepest insulation, so the
// duct's connection reads above any blanket.
export const REGISTER_BOOT = { size: 0.34, clear: 0.04 } as const

// Working numbers, tuned by eye: how far hung ducts run over the deepest insulation, the straps' width, and their spacing.
export const HUNG_DUCTS = { clear: 0.05, strap: 0.02, strapSpacing: 1.2 } as const

// Working numbers, tuned by eye. A can's housing height; how far a vent pipe stands over the covering, and its flashing; the
// foam collar round an opening's base.
export const CEILING_OPENING_LOOK = {
  canHeight: 0.16,
  stubAbove: 0.3,
  flashing: { reach: 0.05, height: 0.02 },
  collar: { reach: 0.03, height: 0.03 },
} as const
