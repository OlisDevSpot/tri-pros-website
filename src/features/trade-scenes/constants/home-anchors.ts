import type { HomeSystemId } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { COVERING_BASE, HOUSE, LOW_SLOPE, LOW_SLOPE_ROOF_Y, RAFTER_ORIGIN_Y, RIDGE_Y, SLOPE_LENGTH, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { LOOK_INSIDE_WINDOW } from '@/features/trade-scenes/constants/look-inside'

type HomeAnchorId = 'roof' | 'attic' | 'under-floor'

interface HomeAnchor {
  position: [number, number, number]
}

const MID_SLOPE = SLOPE_LENGTH / 2

const SHARED_ANCHORS: Omit<Record<HomeAnchorId, HomeAnchor>, 'roof'> = {
  'attic': { position: [-0.6, WALL_TOP_Y + 0.6, -1.5] },
  'under-floor': { position: [0, HOUSE.floorY / 2, HOUSE.halfDepth - 0.4] },
}

// Where a system's view looks and, for the roof and the attic, where its spot pin stands, so the pin and the pick that
// follows it land on the same spot. Pitched: mid-slope on the cut edge of the near slope, on the covering. Low-slope: the
// same point of the cut, on the membrane.
export const HOME_ANCHORS: Record<RoofForm, Record<HomeAnchorId, HomeAnchor>> = {
  'pitched': {
    roof: {
      position: [
        HOUSE.cutX,
        RAFTER_ORIGIN_Y + MID_SLOPE * Math.sin(HOUSE.pitch) + (COVERING_BASE + 0.03) * Math.cos(HOUSE.pitch),
        HOUSE.halfDepth - MID_SLOPE * Math.cos(HOUSE.pitch),
      ],
    },
    ...SHARED_ANCHORS,
  },
  'low-slope': {
    roof: { position: [HOUSE.cutX, LOW_SLOPE_ROOF_Y, HOUSE.halfDepth / 2] },
    ...SHARED_ANCHORS,
  },
}

// The foundation's view into the crawl, on a raised home with the house partly open. Below the raised floor's edge and
// right of the stair, so the open front shows the batts between the joists; the lift raises it with the floor, which keeps
// the target above the ground.
export const CRAWL_FRAMING: CameraFraming = { position: [-3.2, 0.3, 7.6], target: [0.8, 0.12, 3], fov: 38 }

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

// While the windows are in focus the house is held closed, so the window reading stands on the window their Look inside
// opens: on its glass at its inside face, toward the end clear of the parts' pins, low enough that its label stays under
// the arrows and clear of the pins pulled apart. Working numbers, set by screenshot.
const OPENED_WINDOW_SPOT = { along: 0.5, rise: 1.15 } as const
const OPENED_WINDOW_INSIDE = LOOK_INSIDE_WINDOW.wall.line - LOOK_INSIDE_WINDOW.wall.outward * HOUSE.wallThickness / 2
const OPENED_WINDOW_ALONG = LOOK_INSIDE_WINDOW.opening.along + OPENED_WINDOW_SPOT.along
const OPENED_WINDOW_READING: [number, number, number] = LOOK_INSIDE_WINDOW.wall.run === 'x'
  ? [OPENED_WINDOW_ALONG, HOUSE.floorY + OPENED_WINDOW_SPOT.rise, OPENED_WINDOW_INSIDE]
  : [OPENED_WINDOW_INSIDE, HOUSE.floorY + OPENED_WINDOW_SPOT.rise, OPENED_WINDOW_ALONG]

// Where each reading stands with this system in focus: the whole home's, but on the opened window while the windows are in
// focus. The walls hold the house closed too, but open no window, so they keep the whole home's.
export function readingAnchors(form: RoofForm, cameraFocus: HomeSystemId | null): Record<ReadingId, [number, number, number]> {
  return cameraFocus === 'windows' ? { ...READING_ANCHORS[form], window: OPENED_WINDOW_READING } : READING_ANCHORS[form]
}
