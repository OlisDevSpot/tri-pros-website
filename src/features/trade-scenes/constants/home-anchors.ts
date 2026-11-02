import type { CameraFraming } from '@/shared/components/scene/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { COVERING_BASE, HOUSE, LOW_SLOPE, LOW_SLOPE_ROOF_Y, RAFTER_ORIGIN_Y, RIDGE_Y, SLOPE_LENGTH, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'

export const HOME_ANCHOR_IDS = ['roof', 'attic', 'exterior-wall', 'yard', 'under-floor'] as const
export type HomeAnchorId = typeof HOME_ANCHOR_IDS[number]

export interface HomeAnchor {
  position: [number, number, number]
  framing: CameraFraming
}

const MID_SLOPE = SLOPE_LENGTH / 2

// The zoom looks at the roof anchor from the front-left and a little above, close enough that the assembly kit fills the view.
function roofAnchor(position: [number, number, number]): HomeAnchor {
  const [x, y, z] = position
  return { position, framing: { position: [x - 4.4, y + 1.9, z + 5.2], target: [x, y - 0.2, z], fov: 35 } }
}

const SHARED_ANCHORS: Omit<Record<HomeAnchorId, HomeAnchor>, 'roof'> = {
  'attic': {
    position: [-0.6, WALL_TOP_Y + 0.6, -1.5],
    framing: { position: [-3.6, WALL_TOP_Y + 2.1, 4.8], target: [-0.6, WALL_TOP_Y + 0.6, -1.5], fov: 40 },
  },
  'exterior-wall': {
    position: [-HOUSE.halfLength + HOUSE.wallThickness / 2, HOUSE.floorY + 1.25, HOUSE.halfDepth],
    framing: { position: [-9.6, 2.7, 8.6], target: [-HOUSE.halfLength, HOUSE.floorY + 1.25, HOUSE.halfDepth], fov: 38 },
  },
  'yard': {
    position: [-3, 0, 7.5],
    framing: { position: [-8, 4, 15], target: [-3, 0, 7.5], fov: 40 },
  },
  'under-floor': {
    position: [0, HOUSE.floorY / 2, HOUSE.halfDepth - 0.4],
    // Below the raised floor's edge and right of the stair, so the open front shows the batts between the joists; the lift
    // raises it with the floor, which keeps the target above the ground.
    framing: { position: [-3.2, 0.3, 7.6], target: [0.8, 0.12, 3], fov: 38 },
  },
}

// One lookup for the pin, the zoom glide and the assembly kit's placement, so all three land on the same spot of the roof.
// Pitched: mid-slope on the cut edge of the near slope, on the covering. Low-slope: the same point of the cut, on the membrane.
export const HOME_ANCHORS: Record<RoofForm, Record<HomeAnchorId, HomeAnchor>> = {
  'pitched': {
    roof: roofAnchor([
      HOUSE.cutX,
      RAFTER_ORIGIN_Y + MID_SLOPE * Math.sin(HOUSE.pitch) + (COVERING_BASE + 0.03) * Math.cos(HOUSE.pitch),
      HOUSE.halfDepth - MID_SLOPE * Math.cos(HOUSE.pitch),
    ]),
    ...SHARED_ANCHORS,
  },
  'low-slope': {
    roof: roofAnchor([HOUSE.cutX, LOW_SLOPE_ROOF_Y, HOUSE.halfDepth / 2]),
    ...SHARED_ANCHORS,
  },
}

// The thermal camera's three readings, in the order a homeowner follows the heat: the roof, the space under it, the ceiling.
export const SECTION_READING_IDS = ['roof', 'attic', 'ceiling'] as const
export type SectionReadingId = typeof SECTION_READING_IDS[number]

export const READING_IDS = [...SECTION_READING_IDS, 'exterior-wall', 'window'] as const
export type ReadingId = typeof READING_IDS[number]

// Taken inside the house, so they read as rings while it is Complete and fill in as it opens.
export const INSIDE_READING_IDS = ['attic', 'ceiling'] as const

// Every label is a DOM pin centred on its point, and the roof's own pin sits mid-roof at the cut, so from the corner-on
// views each reading needs its own patch of screen: the roof is read at the left end of its ridge, clear of the sun's arrows,
// the attic over the living room, the ceiling at its cut edge in the bedroom.
// The thin joist space reads lower on screen than an attic, so its label sits left of the roof's pin.
const FLAT_JOIST_READING_X = -0.9
const CEILING_READING: [number, number, number] = [-4.6, WALL_TOP_Y - HOUSE.ceilingThickness - 0.05, HOUSE.atticFrontZ]

// The sunny wall is the left one, its window at z 0.4. Working numbers, tuned at the owner's review: the exterior wall is read
// on the stucco clear of the window, the glass on its lower pane, under the arrows through its middle.
const EXTERIOR_WALL_READING: [number, number, number] = [-HOUSE.halfLength - 0.05, HOUSE.floorY + 0.55, 3.4]
const WINDOW_READING: [number, number, number] = [-HOUSE.halfLength + HOUSE.wallThickness, HOUSE.floorY + 1.15, 0.4]
const ROOF_READING_X = -HOUSE.halfLength + 0.8

export type CalloutOffset = readonly [number, number]

export interface ReadingCallout {
  offset: CalloutOffset
  narrowOffset?: CalloutOffset
}

// Every reading marks its spot with a dot and holds its label just off the house on a short line, in px on screen: the roof's
// above it, the attic's up and to its left, the ceiling's beside it on the right, so the home and its arrows stay in sight.
// The sun's arrows land on the roof just right of the attic's dot, so its label keeps off them. The house and the garage fill
// the scene nearly edge to edge, so the house starts close to the scene's left edge and leaves no lawn left of it: the
// ceiling's, the window's and the wall's labels stand on its front, each a little further down than the one above. The
// house is only about two thirds of the scene's width, so its dots crowd: on the smallest scene the window's and the wall's
// sit about 24 px apart and the ceiling's 20 px above the window's, and each label clears the one above it by a few px there,
// more on any larger house. A narrow scene drops the ceiling's under the button that looks inside the roof and moves the
// attic's up and right, high enough that the arrowheads show under it; the roof's stands low enough to clear the build
// switch on a phone. Working numbers, tuned by eye.
export const READING_CALLOUTS: Record<ReadingId, ReadingCallout> = {
  'roof': { offset: [18, -40], narrowOffset: [0, -70] },
  'attic': { offset: [-24, -20], narrowOffset: [8, -26] },
  'ceiling': { offset: [22, 16], narrowOffset: [22, 52] },
  'exterior-wall': { offset: [22, 98] },
  'window': { offset: [22, 76] },
}

export const READING_ANCHORS: Record<RoofForm, Record<ReadingId, [number, number, number]>> = {
  'pitched': {
    'roof': [ROOF_READING_X, RIDGE_Y + COVERING_BASE / Math.cos(HOUSE.pitch), 0],
    'attic': SHARED_ANCHORS.attic.position,
    'ceiling': CEILING_READING,
    'exterior-wall': EXTERIOR_WALL_READING,
    'window': WINDOW_READING,
  },
  'low-slope': {
    'roof': [ROOF_READING_X, LOW_SLOPE_ROOF_Y, -HOUSE.halfDepth * 0.5],
    'attic': [FLAT_JOIST_READING_X, WALL_TOP_Y + LOW_SLOPE.joistSpace * 0.8, HOUSE.atticFrontZ],
    'ceiling': CEILING_READING,
    'exterior-wall': EXTERIOR_WALL_READING,
    'window': WINDOW_READING,
  },
}
