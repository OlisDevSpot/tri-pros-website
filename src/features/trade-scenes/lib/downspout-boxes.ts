import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { DOWNSPOUT_LOOK, DOWNSPOUTS, GUTTER_OUT, GUTTER_Y, HOME_FLOOR_Y, HOUSE, LOW_SLOPE_DECK_Y } from '@/features/trade-scenes/constants/home-geometry'
import { groundTopAlong } from '@/features/trade-scenes/lib/ground-top-along'
import { gutterDropAt, gutterRunSpans } from '@/features/trade-scenes/lib/gutter-run'

type At = readonly [number, number]
interface Split { kept: BoxSpec[], complete: BoxSpec[] }

const MEMBRANE_Y = LOW_SLOPE_DECK_Y + HOUSE.deckThickness
const { halfDepth: D, wallThickness: T } = HOUSE
const { gooseneckDrop: GOOSENECK_DROP, tornGap: TORN_GAP, sleeve: SLEEVE, shoe: SHOE } = DOWNSPOUT_LOOK
const { outline: OUTLINE } = ROOF_TRIM.gutter.profile
const GUTTER_BOTTOM_UP = Math.min(...OUTLINE.map(([, up]) => up))
// The outlet is cut through the middle of the gutter's flat bottom.
const BOTTOM_OUTS = OUTLINE.filter(([, up]) => up === GUTTER_BOTTOM_UP).map(([out]) => out)
const OUTLET_OUT = (Math.min(...BOTTOM_OUTS) + Math.max(...BOTTOM_OUTS)) / 2
// Both forms hang the same pipe, so an outlet needs no form to find its end.
const PIPE = DOWNSPOUTS.pitched.section
// The house's frame stands this far above the world's on a slab, and rises this much more on a raised floor.
const SLAB_LIFT = HOME_FLOOR_Y.slab - HOUSE.floorY
const RISE = HOME_FLOOR_Y.raised - HOME_FLOOR_Y.slab
// So the downspout's end is still inside the sleeve at the top of the ease.
const SLEEVE_OVERLAP = 0.02
const [FITTING_ACROSS, FITTING_DEPTH] = [PIPE.across + SLEEVE, PIPE.out + SLEEVE]
const { radius: R, turn: TURN, pieces: PIECES, tail: TAIL, clearance: CLEARANCE } = SHOE
const STEP = TURN / PIECES
// How far out from the downspout's axis the mouth's centre lands, and how far below where the bend starts.
const REACH = R * (1 - Math.cos(TURN)) + TAIL * Math.sin(TURN)
const DROP = R * Math.sin(TURN) + TAIL * Math.cos(TURN)

const formKey = (form: RoofForm) => form === 'pitched' ? 'pitched' : 'lowSlope'
// Partly open takes the left front set off with the Complete house; the back sets stand at the same x and stay.
const inComplete = ([x, z]: At) => z > 0 && x < HOUSE.cutX

// World frame: where the shoe's bend starts, high enough that the mouth clears the highest ground under the shoe.
function bendTop([x, z]: At): number {
  return groundTopAlong(x, z, z + Math.sign(z) * REACH) + CLEARANCE + DROP + Math.sin(TURN) * FITTING_DEPTH / 2
}

// House frame: down to where the shoe's bend starts on a slab, so on a raised floor it ends `RISE` higher, still in the sleeve.
function vertical(at: At, top: number): BoxSpec {
  const [x, z] = at
  const bottom = bendTop(at) - SLAB_LIFT
  return { size: [PIPE.across, top - bottom, PIPE.out], position: [x, (top + bottom) / 2, z] }
}

// An elbow pair under the outlet: a short drop, then back to the wall, where the downspout takes over.
function gableSet(at: At, gutterBottom: number): BoxSpec[] {
  const [x, z] = at
  const outlet = Math.sign(z) * (GUTTER_OUT + OUTLET_OUT)
  const elbow = gutterBottom - GOOSENECK_DROP
  return [
    { size: [PIPE.across, GOOSENECK_DROP - PIPE.out, PIPE.out], position: [x, gutterBottom - (GOOSENECK_DROP - PIPE.out) / 2, outlet] },
    { size: [PIPE.across, PIPE.out, Math.abs(outlet - z) + PIPE.out], position: [x, elbow + PIPE.out / 2, (outlet + z) / 2] },
    vertical(at, elbow),
  ]
}

function split(at: readonly At[], boxesOf: (at: At) => BoxSpec[]): Split {
  return {
    kept: at.filter(each => !inComplete(each)).flatMap(boxesOf),
    complete: at.filter(inComplete).flatMap(boxesOf),
  }
}

// House frame, every set whole. A gable's downspouts drop from its gutters; a flat roof's from a scupper through the back parapet.
export function downspoutBoxes(form: RoofForm): BoxSpec[] {
  if (form === 'pitched') {
    return DOWNSPOUTS.pitched.at.flatMap(at => gableSet(at, GUTTER_Y + GUTTER_BOTTOM_UP))
  }
  return DOWNSPOUTS.lowSlope.at.flatMap(at => [
    { size: [0.24, 0.12, T + 0.16], position: [at[0], MEMBRANE_Y + 0.08, -D + T / 2 - 0.04] } satisfies BoxSpec,
    vertical(at, MEMBRANE_Y),
  ])
}

// At Failing the pulled end has torn the downspout under it away from the gutter.
function torn(wear: Wear, [x, z]: At): boolean {
  const { pulled } = gutterRunSpans(wear)
  return pulled !== null && z > 0 && x >= pulled[0] && x <= pulled[1]
}

// House frame. Each gooseneck hangs from the gutter where it sags.
export function gableDownspouts(wear: Wear): Split {
  return split(DOWNSPOUTS.pitched.at, (at) => {
    const gutterBottom = GUTTER_Y - gutterDropAt(wear, at[1] > 0 ? 'front' : 'back', at[0]) + GUTTER_BOTTOM_UP
    return torn(wear, at) ? [vertical(at, gutterBottom - TORN_GAP)] : gableSet(at, gutterBottom)
  })
}

// The sets the gutter still drains into. A flat roof's scuppers take its water whatever its gutter's wear.
export function drainingDownspouts(form: RoofForm, wear: Wear): { kept: At[], complete: At[] } {
  const at = form === 'pitched' ? DOWNSPOUTS.pitched.at.filter(each => !torn(wear, each)) : DOWNSPOUTS.lowSlope.at
  return { kept: at.filter(each => !inComplete(each)), complete: at.filter(inComplete) }
}

// World frame, `turned` radians round the bend from straight down: the point on the bend's arc.
function onBend([x, z]: At, top: number, turned: number): Vec3 {
  return [x, top - R * Math.sin(turned), z + Math.sign(z) * R * (1 - Math.cos(turned))]
}

function piece(side: number, centre: Vec3, turned: number, length: number): BoxSpec {
  return { size: [FITTING_ACROSS, length, FITTING_DEPTH], position: centre, rotation: [-side * turned, 0, 0] }
}

// World frame: the sleeve the downspout slides in, the bend in short lengths, each a little long so the outside of the bend
// shows no gap between them, then the tail out to the mouth.
function foot(at: At): BoxSpec[] {
  const [x, z] = at
  const side = Math.sign(z)
  const top = bendTop(at)
  const sleeve: BoxSpec = { size: [FITTING_ACROSS, RISE + SLEEVE_OVERLAP, FITTING_DEPTH], position: [x, top + (RISE + SLEEVE_OVERLAP) / 2, z] }
  const length = R * STEP + FITTING_DEPTH * Math.tan(STEP / 2)
  const bend = Array.from({ length: PIECES }, (_, i) => piece(side, onBend(at, top, (i + 0.5) * STEP), (i + 0.5) * STEP, length))
  const [, endY, endZ] = onBend(at, top, TURN)
  const tail = piece(side, [x, endY - Math.cos(TURN) * TAIL / 2, endZ + side * Math.sin(TURN) * TAIL / 2], TURN, TAIL)
  return [sleeve, ...bend, tail]
}

// World frame: the feet stand on the lawn whatever the floor is easing to, while the downspouts slide down inside them.
export function downspoutFeet(form: RoofForm): Split {
  return split(DOWNSPOUTS[formKey(form)].at, foot)
}

// World frame: the centre of the shoe's mouth, where the water leaves.
export function downspoutOutlet(at: At): Vec3 {
  const [x, z] = at
  return [x, bendTop(at) - DROP, z + Math.sign(z) * REACH]
}
