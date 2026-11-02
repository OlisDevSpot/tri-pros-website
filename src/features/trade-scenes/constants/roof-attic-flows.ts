import type { HomePaintKey } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { PaintFaces } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { KIT_PIN_Z } from '@/features/trade-scenes/constants/roof-attic-kit'

type Vec2 = readonly [number, number]

// Working numbers, tuned at the owner's review: the flows drawn through the roof-attic kit, in the kit's metres.
export const KIT_FLOW = {
  // A full flow (share 1) draws this wide; a share is drawn to scale, so the narrowing is the story.
  width: 0.4,
  // A share above zero never draws thinner than this, so a small flow still reads as a thread from across the table.
  minWidth: 0.035,
  // The flows run just in front of the section's cut end, where every part shows its edge, so no part ever hides them.
  z: KIT_PIN_Z - 0.24,
  // How far up the front slope the line crosses the gable's parts.
  pitchedAlong: 1.15,
  // Where the line crosses a flat roof, clear of the part pins.
  lowSlopeX: -0.9,
  // From the covering to where the sun or the rain comes from, and where winter heat escapes to.
  sky: { 'pitched': [0, 1.1], 'low-slope': [-0.3, 1] } as const satisfies Record<RoofForm, Vec2>,
  // The sun the covering turns back, bounced off its slope.
  reflected: { 'pitched': [-0.6, 0.45], 'low-slope': [0.3, 0.75] } as const satisfies Record<RoofForm, Vec2>,
  // The heat the radiant barrier turns back, as [along the roof toward the eave, up toward the deck] from the barrier's
  // underside. It ends under the deck even at rest, so it never paints over the covering as though it left the roof: on
  // the gable it runs down the slope through the rafter bay; on a flat roof, whose foil is stapled to the deck, it runs
  // sideways and a little down into the joist bay.
  barrierBounce: { 'pitched': [0.4, 0.1], 'low-slope': [0.3, -0.04] } as const satisfies Record<RoofForm, Vec2>,
  // A flat roof's layers sit a hand's width over its ceiling, too close to keep the arrows into the attic apart on a plumb
  // line, so the heat crosses its barrier out here and slants back to the flow line through the joist bay, clear of the
  // insulation's pin.
  lowSlopeHeatX: -1.5,
  // On the gable the heat meets the barrier this far further down the slope than it crossed the deck, slanting through the
  // rafter bay, so the arrows from the covering to the barrier have room to read apart.
  pitchedBarrierAlong: 0.4,
  // Above the barrier a flat roof is thinner still, so the heat meets its covering this much further out and slants
  // through the cap sheet, membrane and deck down to the barrier, keeping those arrows apart too.
  lowSlopeCoveringSlant: -0.3,
  // Below the ceiling, into the room under it.
  room: 0.42,
  // Water rides this high over the surface it sheds along.
  sheetOver: 0.025,
  // Water leaves the drip edge just out from its plumb leg.
  offEdge: [-0.03, -0.06] as const satisfies Vec2,
  // Where no gutter catches it, water off the eave falls this far past the wall.
  spill: [-0.08, -0.9] as const satisfies Vec2,
  // Water lands in the gutter's trough a little way in from the cut end, so it reads as caught.
  gutterZ: KIT_PIN_Z + 0.25,
  // A part thinner than this along the line gets one station at its middle instead of one per face.
  faceStationMin: 0.02,
  // Below this the flow has stopped.
  stopped: 1e-3,
  // Kept low enough that the core keeps its hue under the additive glow instead of burning white.
  intensity: { main: 1.3 },
  // Scroll speed while a burst runs.
  speed: 0.6,
} as const

// How far each covering stands off its underlayment, where a flow meets its outer face.
export const KIT_COVERING_RISE: Readonly<Record<string, number>> = {
  'default': 0.03,
  'tile': 0.13,
  'wood-shake': 0.04,
}

export const KIT_FLOW_COLORS = {
  rain: '#4fb3ff',
} as const

// A worn part the rain walk soaked: a dark rot patch where the water crosses it, sized by the share it soaked. A part up to
// `throughMax` thick is stained right through, so the rot shows from the attic as well as from above.
export const KIT_ROT = { radius: 0.55, color: '#2c2118', lift: 0.004, throughMax: 0.05, segments: 28, z: KIT_PIN_Z + 0.24 } as const

// The drip under a ceiling the rain gets past, in the home's drip look, falling into the room below the kit's ceiling; drawn
// larger than the home's so a drop still reads from the zoom's distance, and hung under the ceiling itself, just in from the
// cut end, beside the flow's end rather than inside it.
export const KIT_DRIP = { fall: 0.5, scale: 1.8, z: KIT_PIN_Z + 0.12 } as const

// Where the section's three readings are pinned. The roof's reading rides the covering and the ceiling's the ceiling as they
// peel; the attic's stays in the air between them. Working numbers, tuned at the owner's review: the heat's arrows run
// straight down the section just in front of its cut end, and on a tablet each label is wider than the section is deep,
// so the labels stand either side of the arrows rather than on them. On the gable the roof's sits up the shingles away
// from the cut end, the attic's under the back slope, the ceiling's where the ceiling meets the front wall; on a flat roof
// the roof's and the joist space's stack at the back of the cut end and the ceiling's sits at the front wall.
export const KIT_READING_SPOTS = {
  'pitched': {
    roof: { rider: 'covering', slopeAlong: 1.9, over: 0.06, z: KIT_PIN_Z + 1.7 },
    attic: { rider: null, point: [1.2, 0.34, KIT_PIN_Z] },
    ceiling: { rider: 'ceiling', point: [-1.95, -0.08, KIT_PIN_Z] },
  },
  'low-slope': {
    roof: { rider: 'covering', point: [1.5, 0.62, KIT_PIN_Z + 0.4] },
    attic: { rider: null, point: [1.1, 0.12, KIT_PIN_Z] },
    ceiling: { rider: 'ceiling', point: [-1.9, -0.1, KIT_PIN_Z] },
  },
} as const

// The home's paint zones a kit part's two faces read as, matching the groups the home tags, so the zoomed parts and the house
// wear one colour: the face toward the rooms, and the face toward the sky. Any part not listed is the roof's.
export const KIT_PART_PAINT_FACES: Readonly<Record<string, PaintFaces>> = {
  'ceiling': { inner: 'ceiling', outer: 'attic' },
  'air-sealing': { inner: 'ceiling', outer: 'attic' },
  'attic-insulation': { inner: 'ceiling', outer: 'attic' },
  'rafters': { inner: 'attic', outer: 'attic' },
  'radiant-barrier': { inner: 'attic', outer: 'attic' },
}

export const KIT_DEFAULT_PAINT_FACES: PaintFaces = { inner: 'attic', outer: 'roof' }

// The kit's wall stubs and parapet are the house's outside walls.
export const KIT_FRAME_PAINT_ZONE: HomePaintKey = 'exterior'
