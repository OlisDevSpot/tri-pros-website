import type { CameraFraming, PointerSample, WheelSample } from '@/shared/components/scene/types'
import assert from 'node:assert/strict'

import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { applyRingWidths } from '@/shared/components/scene/lib/apply-ring-widths'
import { buildUnitTube, RIBBON_RADIAL_SEGMENTS } from '@/shared/components/scene/lib/build-unit-tube'
import { cameraFramingKey, cameraGoal } from '@/shared/components/scene/lib/camera-goal'
import { clampOrbitToBox } from '@/shared/components/scene/lib/clamp-orbit-to-box'
import { classifyWheelStream } from '@/shared/components/scene/lib/classify-wheel-stream'
import { createSceneCamera, recenterCamera } from '@/shared/components/scene/lib/create-scene-camera'
import { createTapTracker } from '@/shared/components/scene/lib/create-tap-tracker'
import { createWheelRouter } from '@/shared/components/scene/lib/create-wheel-router'
import { dampValue, easeStepSeconds, isSettled } from '@/shared/components/scene/lib/damp-value'
import { doubleTapFraming } from '@/shared/components/scene/lib/double-tap-framing'
import { isDoubleTapStop } from '@/shared/components/scene/lib/is-double-tap-stop'
import { mixValue } from '@/shared/components/scene/lib/mix-value'
import { panOffset } from '@/shared/components/scene/lib/pan-offset'
import { panSpeedFor, visibleHeight, worldPerPixel } from '@/shared/components/scene/lib/pan-scale'
import { samplePalette } from '@/shared/components/scene/lib/sample-palette'
import { sampleProfile } from '@/shared/components/scene/lib/sample-profile'
import { startsWheelStream } from '@/shared/components/scene/lib/starts-wheel-stream'
import { tapRingRemainingMs } from '@/shared/components/scene/lib/tap-ring-remaining-ms'
import { wheelZoomScale } from '@/shared/components/scene/lib/wheel-zoom-scale'

// One 60 fps frame covers about 9.5% of the way at damping 6.
const step = dampValue(0, 1, 1 / 60)
assert.ok(step > 0.09 && step < 0.1, `one frame moves ~9.5%, got ${step}`)

// The DOM transition and the 3D ease land together: after the DOM duration the value is ~95% there.
let value = 0
for (let frame = 0; frame < 30; frame++) value = dampValue(value, 1, 1 / 60)
assert.ok(value > 0.94 && value < 0.96, `after ${SCENE_MOTION.transition.duration}s ~95%, got ${value}`)

// A backgrounded tab returns with a huge delta; the step is clamped so nothing snaps.
assert.equal(dampValue(0, 1, 5), dampValue(0, 1, SCENE_MOTION.maxFrameSeconds), 'delta is clamped')

// Vectors and colours ease per component.
const vector = dampValue([0, 10, -4] as const, [1, 10, 0] as const, 1 / 60)
assert.equal(vector.length, 3)
assert.equal(vector[1], 10, 'a settled component stays put')
assert.ok(vector[2] > -4 && vector[2] < 0, 'each component moves toward its own target')

assert.equal(isSettled(1, 1 + SCENE_MOTION.settled / 2), true)
assert.equal(isSettled([0, 0], [0, 0.01]), false)

// The first frame after idle carries a long raw delta; it must read as one 60 fps frame, not the 0.1 s clamp.
assert.equal(easeStepSeconds(true, 3), SCENE_MOTION.restFrameSeconds)
assert.equal(easeStepSeconds(false, 0.05), 0.05)
assert.ok(dampValue(0, 1, easeStepSeconds(true, 3)) < 0.1, 'first frame from rest stays under 10%')

// A tween mixes from where the value was toward the target by the curve's progress, per component.
assert.equal(mixValue(2, 4, 0.25), 2.5)
assert.deepEqual(mixValue([0, 10, -4] as const, [1, 10, 0] as const, 0.5), [0.5, 10, -2])
assert.deepEqual(mixValue([0.3, 0.1, 0] as const, [0, 0.1, 0] as const, 1), [0, 0.1, 0], 'progress 1 lands on the target')

const stops = [[0, 0, 0], [0.25, 0, 0], [0.5, 0, 0], [0.75, 0, 0], [1, 0, 0]] as const
assert.deepEqual(samplePalette(stops, 0), [0, 0, 0], 'cold end')
assert.deepEqual(samplePalette(stops, 1), [1, 0, 0], 'hot end')
assert.deepEqual(samplePalette(stops, 0.5), [0.5, 0, 0], 'middle stop')
assert.ok(Math.abs(samplePalette(stops, 0.125)[0] - 0.125) < 1e-9, 'blends between stops')
assert.deepEqual(samplePalette(stops, 2), [1, 0, 0], 'clamped above 1')
assert.deepEqual(samplePalette(stops, -1), [0, 0, 0], 'clamped below 0')

assert.equal(sampleProfile([1, 0.5, 0], 0), 1)
assert.equal(sampleProfile([1, 0.5, 0], 0.5), 0.5)
assert.equal(sampleProfile([1, 0.5, 0], 0.75), 0.25)
assert.equal(sampleProfile([1, 0.5, 0], 1.5), 0, 'clamped')
assert.equal(sampleProfile([0.3], 0.7), 0.3, 'a single width is constant')

assert.equal(sampleProfile([], 0.5), 0, 'an empty profile is zero, not NaN')

// The tube's ring radius follows the width profile: wide at the start, a trickle at the end.
const segments = 8
const { geometry: tube, centres } = buildUnitTube([[0, 0, 0], [0, -1, 0], [0, -2, 0]], segments)
const positions = tube.getAttribute('position')
const normals = tube.getAttribute('normal')
const ringWidths = Array.from({ length: segments + 1 }, (_, ring) => sampleProfile([0.4, 0.04], ring / segments))
applyRingWidths(positions.array as Float32Array, centres, normals.array as Float32Array, ringWidths, RIBBON_RADIAL_SEGMENTS)
const radialVertices = RIBBON_RADIAL_SEGMENTS + 1
const radiusAt = (ring: number) => Math.hypot(positions.getX(ring * radialVertices), positions.getZ(ring * radialVertices))
assert.ok(Math.abs(radiusAt(0) - 0.2) < 1e-6, `start radius = width/2, got ${radiusAt(0)}`)
assert.ok(Math.abs(radiusAt(8) - 0.02) < 1e-6, `end radius = width/2, got ${radiusAt(8)}`)
assert.ok(Math.abs(radiusAt(4) - 0.11) < 1e-6, `mid radius = mean width/2, got ${radiusAt(4)}`)
applyRingWidths(positions.array as Float32Array, centres, normals.array as Float32Array, ringWidths.map(() => 2), RIBBON_RADIAL_SEGMENTS)
assert.ok(Math.abs(radiusAt(4) - 1) < 1e-6, 'widths re-apply from the unit tube, not cumulatively')
tube.dispose()

assert.equal(panSpeedFor(0, 0), 1)
assert.ok(Math.abs(panSpeedFor(0, 0.46) - 1 / 0.54) < 1e-9, 'a bottom card speeds the pan by the hidden share')
assert.ok(Math.abs(panSpeedFor(0.2, 0.26) - 1 / 0.54) < 1e-9, 'a top cover hides its share as a bottom card does')
assert.ok(Number.isFinite(panSpeedFor(0, 1)) && Number.isFinite(panSpeedFor(0.5, 0.5)), 'a fully covered canvas never divides by zero')
assert.ok(Math.abs(worldPerPixel(10, 90, 500) - 0.04) < 1e-9)
assert.equal(visibleHeight(500, 0, 0), 500)
assert.ok(Math.abs(visibleHeight(500, 0, 0.4) - 300) < 1e-9, 'a bottom card leaves the share above it')
assert.ok(Math.abs(visibleHeight(500, 0.1, 0.3) - 300) < 1e-9, 'a top cover and a bottom card leave the share between them')
assert.ok(visibleHeight(0, 0, 0) > 0 && visibleHeight(500, 0, 1) > 0 && visibleHeight(500, 0.6, 0.4) > 0, 'a collapsed canvas or a full cover never measures zero')

const box = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1))
const t = new Vector3(3, 1, 0)
const p = new Vector3(3, 1, 5)
assert.equal(clampOrbitToBox(t, p, box), true)
assert.deepEqual(t.toArray(), [1, 1, 0])
assert.deepEqual(p.toArray(), [1, 1, 5], 'the camera moves by the same delta, so the orbit keeps its angle')
assert.equal(clampOrbitToBox(t, p, box), false, 'inside the box nothing moves')

const goal = doubleTapFraming({ point: new Vector3(0.5, 0.5, 0.5), position: new Vector3(0, 0, 20), target: new Vector3(0, 0, 0), box, maxDistance: 9 })
assert.deepEqual(goal.target, [0.5, 0.5, 0.5])
assert.ok(Math.abs(new Vector3(...goal.position).distanceTo(new Vector3(...goal.target)) - 9) < 1e-9, 'a far camera comes in to the double-tap distance')
const near = doubleTapFraming({ point: new Vector3(0, 0, 0), position: new Vector3(0, 0, 4), target: new Vector3(0, 0, 1), box, maxDistance: 9 })
assert.ok(Math.abs(near.position[2] - 3) < 1e-9, 'a camera nearer than the double-tap distance keeps its distance')
const outside = doubleTapFraming({ point: new Vector3(5, 5, 5), position: new Vector3(0, 0, 20), target: new Vector3(0, 0, 0), box, maxDistance: 9 })
assert.deepEqual(outside.target, [1, 2, 1], 'a point outside the box is clamped first')

{
  const geometry = new BoxGeometry()
  const glassAt = (opacity: number) => new MeshBasicMaterial({ transparent: true, opacity })
  assert.equal(isDoubleTapStop(new Mesh(geometry, new MeshBasicMaterial()), 0), 'stop', 'an opaque mesh stops the ray')
  const hidden = new Group()
  hidden.visible = false
  const inside = new Mesh(geometry, new MeshBasicMaterial())
  new Group().add(hidden)
  hidden.add(new Group().add(inside))
  assert.equal(isDoubleTapStop(inside, 0), 'through', 'a mesh under a hidden group lets it through')
  const unseen = new Mesh(geometry, new MeshBasicMaterial())
  unseen.visible = false
  assert.equal(isDoubleTapStop(unseen, 0), 'through', 'a hidden mesh lets it through')
  assert.equal(isDoubleTapStop(new Mesh(geometry, glassAt(0.2)), 0), 'through', 'faint see-through lets it through')
  assert.equal(isDoubleTapStop(new Mesh(geometry, glassAt(0.4)), 0), 'stop', 'new window glass stops it')
  assert.equal(isDoubleTapStop(new Mesh(geometry, new MeshBasicMaterial({ opacity: 0.1 })), 0), 'stop', 'opacity counts only on a transparent material')
  const tagged = new Mesh(geometry, glassAt(0.1))
  tagged.userData.doubleTapStop = true
  assert.equal(isDoubleTapStop(tagged, 0), 'stop', 'a tagged faint mesh stops it')
  const mixed = new Mesh(geometry, [new MeshBasicMaterial(), glassAt(0.1)])
  assert.equal(isDoubleTapStop(mixed, 0), 'stop', 'a material array reads the face\'s material')
  assert.equal(isDoubleTapStop(mixed, 1), 'through', 'a faint face of a mixed mesh lets it through')
  assert.equal(isDoubleTapStop(new Mesh(geometry, [glassAt(0.1), new MeshBasicMaterial()]), undefined), 'through', 'no face index reads the first material')
}

// Dragging right moves the content right, so the camera and target move left (-right axis); dragging down moves them up.
const off = panOffset({ dxPx: 10, dyPx: 0, right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), worldPerPx: 0.1 })
assert.deepEqual(off.toArray(), [-1, 0, 0])
assert.deepEqual(panOffset({ dxPx: 0, dyPx: 10, right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), worldPerPx: 0.1 }).toArray(), [0, 1, 0])

const s = (pointerId: number, pointerType: string, x: number, y: number, time: number, { isPrimary = true, button = 0 } = {}): PointerSample => ({ pointerId, pointerType, x, y, time, isPrimary, button })
function tap(tr: ReturnType<typeof createTapTracker>, type: string, x: number, y: number, t0: number, t1: number, id = 1) {
  tr.down(s(id, type, x, y, t0))
  return tr.up(s(id, type, x, y, t1))
}

assert.equal(SCENE_GESTURES.pressTravelPx.touch, SCENE_MOTION.tapSlopPx, 'touch press travel is the roof-tap slop')

{
  const tr = createTapTracker()
  assert.equal(tap(tr, 'touch', 100, 100, 0, 80), 'tap', 'one quick press is a tap')
}
{
  const tr = createTapTracker()
  tap(tr, 'touch', 100, 100, 0, 80)
  assert.equal(tap(tr, 'touch', 120, 100, 250, 320), 'double', 'double tap')
}
{
  const tr = createTapTracker()
  tap(tr, 'touch', 100, 100, 0, 80)
  assert.equal(tap(tr, 'touch', 100, 100, 80 + 301, 80 + 301 + 50), 'tap', 'a slow second tap is a single tap, never a double')
}
{
  const tr = createTapTracker()
  tap(tr, 'touch', 100, 100, 0, 80)
  assert.equal(tap(tr, 'touch', 140, 100, 250, 320), 'tap', 'a far second tap is a single tap, never a double')
}
{
  const tr = createTapTracker()
  assert.equal(tap(tr, 'touch', 100, 100, 0, 350), null, 'long press is no tap')
  assert.equal(tap(tr, 'touch', 100, 100, 400, 450), 'tap', 'a tap after a long press never double-taps')
}
{
  // What a tap on the scene must be to close Systems: one quick press, and never a pinch, a long press or a drag.
  assert.equal(tap(createTapTracker(), 'touch', 100, 100, 0, 80), 'tap', 'one quick press taps')
  const pinch = createTapTracker()
  pinch.down(s(1, 'touch', 100, 100, 0))
  pinch.down(s(2, 'touch', 140, 100, 10, { isPrimary: false }))
  assert.equal(pinch.up(s(2, 'touch', 140, 100, 60)), null)
  assert.equal(pinch.up(s(1, 'touch', 100, 100, 70)), null, 'a two-pointer press is no tap')
  assert.equal(tap(createTapTracker(), 'touch', 100, 100, 0, 301), null, 'a long press is no tap')
  const drag = createTapTracker()
  drag.down(s(1, 'mouse', 100, 100, 0))
  drag.move(s(1, 'mouse', 140, 100, 40))
  assert.equal(drag.up(s(1, 'mouse', 140, 100, 80)), null, 'a 40 px drag is no tap')
}
{
  const tr = createTapTracker()
  for (const base of [0, 200]) {
    tr.down(s(1, 'touch', 100, 100, base))
    tr.down(s(2, 'touch', 140, 100, base + 10, { isPrimary: false }))
    assert.equal(tr.up(s(1, 'touch', 100, 100, base + 60)), null)
    assert.equal(tr.up(s(2, 'touch', 140, 100, base + 70)), null, 'two pointers never tap')
  }
}
{
  const tr = createTapTracker()
  tr.down(s(1, 'touch', 100, 100, 0))
  assert.equal(tr.move(s(1, 'touch', 107, 100, 20)), 'moved', 'touch moved')
  assert.equal(tr.move(s(1, 'touch', 120, 100, 30)), null, 'moved reports once')
  assert.equal(tr.up(s(1, 'touch', 120, 100, 60)), null)
  assert.equal(tap(tr, 'touch', 120, 100, 100, 150), 'tap', 'a moved press leaves no first tap behind')
}
{
  const tr = createTapTracker()
  tr.down(s(1, 'mouse', 100, 100, 0))
  assert.equal(tr.move(s(1, 'mouse', 105, 100, 10)), 'moved', 'mouse 5 px moves')
}
{
  const tr = createTapTracker()
  tr.down(s(1, 'mouse', 100, 100, 0))
  assert.equal(tr.move(s(1, 'mouse', 103, 100, 10)), null, 'mouse 3 px is not a move')
  tr.up(s(1, 'mouse', 103, 100, 50))
  assert.equal(tap(tr, 'mouse', 103, 100, 100, 150), 'double', 'and is still a tap')
}
{
  const tr = createTapTracker()
  for (const base of [0, 150]) {
    tr.down(s(1, 'touch', 100, 100, base))
    tr.move(s(1, 'touch', 108, 100, base + 20))
    assert.equal(tr.up(s(1, 'touch', 108, 100, base + 60)), null, 'drifting touch tap is no tap')
  }
}
{
  const tr = createTapTracker()
  tap(tr, 'mouse', 100, 100, 0, 50)
  assert.equal(tap(tr, 'touch', 100, 100, 100, 150), 'tap', 'a touch after a mouse tap never double-taps')
}

// A failed press must clear a pending first tap: arm one, fail a press, then tap quickly.
const failures: Record<string, (tr: ReturnType<typeof createTapTracker>) => void> = {
  'long press': (tr) => { tap(tr, 'touch', 100, 100, 100, 450) },
  'moved press': (tr) => {
    tr.down(s(1, 'touch', 100, 100, 100))
    tr.move(s(1, 'touch', 120, 100, 110))
    tr.up(s(1, 'touch', 120, 100, 140))
  },
  'drifting press': (tr) => {
    tr.down(s(1, 'touch', 100, 100, 100))
    tr.up(s(1, 'touch', 108, 100, 140))
  },
  'two pointers': (tr) => {
    tr.down(s(1, 'touch', 100, 100, 100))
    tr.down(s(2, 'touch', 130, 100, 105, { isPrimary: false }))
    tr.up(s(1, 'touch', 100, 100, 140))
    tr.up(s(2, 'touch', 130, 100, 150))
  },
  'cancelled press': (tr) => {
    tr.down(s(1, 'touch', 100, 100, 100))
    tr.cancel(1)
  },
}
for (const [name, fail] of Object.entries(failures)) {
  const tr = createTapTracker()
  tap(tr, 'touch', 100, 100, 0, 80)
  fail(tr)
  assert.equal(tap(tr, 'touch', 100, 100, 160, 200, 5), 'tap', `a ${name} leaves no first tap behind`)
}
{
  const tr = createTapTracker()
  tr.down(s(1, 'touch', 100, 100, 0))
  tr.cancel(9)
  assert.equal(tr.up(s(1, 'touch', 100, 100, 50)), 'tap')
  assert.equal(tap(tr, 'touch', 100, 100, 100, 150), 'double', 'cancelling an unknown pointer leaves the live press a tap')
}
{
  const tr = createTapTracker()
  tap(tr, 'touch', 100, 100, 0, 80)
  assert.equal(tap(tr, 'touch', 100, 100, 150, 200), 'double')
  assert.equal(tap(tr, 'touch', 100, 100, 250, 300), 'tap', 'a third quick tap is a fresh first tap')
  assert.equal(tap(tr, 'touch', 100, 100, 350, 400), 'double', 'and the fourth completes it')
}
{
  const tr = createTapTracker()
  tap(tr, 'pen', 100, 100, 0, 80)
  assert.equal(tap(tr, 'pen', 130, 100, 200, 250), 'double', 'a pen double taps like touch')
  tr.down(s(1, 'pen', 100, 100, 400))
  assert.equal(tr.move(s(1, 'pen', 107, 100, 410)), 'moved', 'a pen moves past the touch limit')
}
{
  const tr = createTapTracker()
  tap(tr, 'touch', 100, 100, 0, 80)
  tr.down(s(1, 'touch', 100, 100, 150))
  tr.down(s(2, 'touch', 130, 100, 155, { isPrimary: false }))
  assert.equal(tr.up(s(2, 'touch', 130, 100, 190)), null)
  assert.equal(tr.up(s(1, 'touch', 100, 100, 200)), null, 'the first pointer lifting last still ends a two-pointer press')
  assert.equal(tap(tr, 'touch', 100, 100, 250, 300, 7), 'tap', 'and leaves no first tap behind')
}
{
  const tr = createTapTracker()
  tap(tr, 'touch', 100, 100, 0, 80)
  assert.equal(tap(tr, 'touch', 100, 100, 380, 420), 'double', 'a second down exactly 300 ms later still doubles')
  const late = createTapTracker()
  tap(late, 'touch', 100, 100, 0, 80)
  assert.equal(tap(late, 'touch', 100, 100, 381, 420), 'tap', 'a second down 301 ms later never double-taps')
  const near = createTapTracker()
  tap(near, 'touch', 100, 100, 0, 80)
  assert.equal(tap(near, 'touch', 135, 100, 150, 200), 'double', 'exactly 35 px away still doubles')
  const far = createTapTracker()
  tap(far, 'touch', 100, 100, 0, 80)
  assert.equal(tap(far, 'touch', 135.5, 100, 150, 200), 'tap', 'past 35 px never double-taps')
  const edge = createTapTracker()
  assert.equal(tap(edge, 'touch', 100, 100, 0, 300), 'tap')
  assert.equal(tap(edge, 'touch', 100, 100, 350, 400), 'double', 'a 300 ms press is a tap, so it arms the next one')
}

{
  const tr = createTapTracker()
  const right = { button: 2 }
  tr.down(s(1, 'mouse', 100, 100, 0, right))
  assert.equal(tr.up(s(1, 'mouse', 100, 100, 50, right)), null)
  tr.down(s(1, 'mouse', 100, 100, 100, right))
  assert.equal(tr.up(s(1, 'mouse', 100, 100, 150, right)), null, 'two quick right clicks are no double-tap')
  tap(tr, 'mouse', 100, 100, 200, 250)
  tr.down(s(1, 'mouse', 100, 100, 300, right))
  assert.equal(tr.up(s(1, 'mouse', 100, 100, 350, right)), null, 'a left then a right click are no double-tap')
  assert.equal(tap(tr, 'mouse', 100, 100, 400, 450), 'tap', 'and the right click leaves no first tap behind')
  const middle = createTapTracker()
  tap(middle, 'mouse', 100, 100, 0, 50)
  middle.down(s(1, 'mouse', 100, 100, 100, { button: 1 }))
  assert.equal(middle.up(s(1, 'mouse', 100, 100, 150, { button: 1 })), null, 'a middle click is no tap')
}
{
  const tr = createTapTracker()
  tr.down(s(1, 'mouse', 100, 100, 0, { button: 2 }))
  assert.equal(tr.move(s(1, 'mouse', 110, 100, 20, { button: -1 })), 'moved', 'a right drag still moves the camera')
}
{
  const tr = createTapTracker()
  tr.down(s(2, 'touch', 100, 100, 0, { isPrimary: false }))
  assert.equal(tr.up(s(2, 'touch', 100, 100, 50, { isPrimary: false })), null)
  assert.equal(tap(tr, 'touch', 100, 100, 100, 150), 'tap', 'a lone second finger whose first landed elsewhere leaves no first tap behind')
}
{
  // A touch whose up and cancel both went missing.
  const tr = createTapTracker()
  tr.down(s(1, 'touch', 100, 100, 0))
  tap(tr, 'touch', 100, 100, 5000, 5050, 2)
  assert.equal(tap(tr, 'touch', 100, 100, 5100, 5150, 3), 'double', 'a primary down after a stuck press double-taps again')
  tr.down(s(1, 'touch', 100, 100, 9000))
  tr.down(s(4, 'touch', 100, 100, 9500))
  assert.equal(tr.move(s(4, 'touch', 120, 100, 9520)), 'moved', 'and moves again after a stuck press')
}

const w = (o: Partial<WheelSample>): WheelSample => ({ deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, timeStamp: 0, ...o })
assert.equal(classifyWheelStream([w({ deltaY: 8.000488281 })]), 'mouse', 'a notch multiple is a mouse')
assert.equal(classifyWheelStream([w({ deltaX: 1.5, deltaY: 6 })]), 'trackpad', 'horizontal delta is a trackpad')
assert.equal(classifyWheelStream([w({ deltaY: 2 })]), 'trackpad', 'a small delta is a trackpad')
assert.equal(classifyWheelStream([w({ deltaY: 100, timeStamp: 0 })]), null, 'one large sample is undecided')
assert.equal(classifyWheelStream([w({ deltaY: 100, timeStamp: 0 }), w({ deltaY: 100, timeStamp: 60 })]), 'mouse', 'sparse cadence is a mouse')
assert.equal(classifyWheelStream([w({ deltaY: 9, timeStamp: 0 }), w({ deltaY: 9, timeStamp: 16 })]), 'trackpad', 'dense cadence is a trackpad')
assert.equal(classifyWheelStream([w({ deltaX: 3, shiftKey: true })]), null, 'shift turns deltaY into deltaX, which proves nothing')
assert.equal(classifyWheelStream([w({ deltaX: 3, shiftKey: true, timeStamp: 0 }), w({ deltaX: 3, shiftKey: true, timeStamp: 16 })]), null, 'a Shift-wheel stream has no deltaY to read cadence from')
assert.equal(classifyWheelStream([w({ deltaMode: 1, deltaY: 3 })]), 'mouse', 'line mode is a mouse')

{
  const cam = createSceneCamera()
  assert.deepEqual(cam.getState(), { moved: false, recenters: 0, tapMark: null })
  cam.setState({ moved: true })
  recenterCamera(cam)
  assert.equal(cam.getState().moved, false, 'recenter clears moved')
  assert.equal(cam.getState().recenters, 1, 'and counts')
}

{
  const home: CameraFraming = { position: [1, 2, 3], target: [0, 0, 0], fov: 40 }
  const close: CameraFraming = { position: [1, 2, 1], target: [0, 0, 0], fov: 40 }
  const goal: CameraFraming = { position: [5, 5, 5], target: [1, 1, 1], fov: 40 }
  const key = cameraFramingKey(home)
  assert.equal(key, '1,2,3|0,0,0|40', 'the key is the framing values')
  assert.equal(cameraFramingKey({ ...home, position: [1, 2, 3] }), key, 'equal values, equal key')
  const start = { framingKey: key, recenters: 0, doubleTapId: 0, doubleTap: null }
  const request = { id: 1, goal }
  const tapped = cameraGoal(start, { framingKey: key, recenters: 0, doubleTap: request })
  assert.equal(tapped.state.doubleTap, goal)
  assert.equal(tapped.resetMoved, false)
  const strict = cameraGoal(start, { framingKey: key, recenters: 0, doubleTap: request })
  assert.deepEqual(strict.state, tapped.state, 'a render run twice from the same committed state folds the request the same way')
  const same = cameraGoal(tapped.state, { framingKey: key, recenters: 0, doubleTap: request })
  assert.equal(same.state, tapped.state, 'an equal render keeps the goal and folds the request only once')
  assert.equal(same.resetMoved, false)
  const again = cameraGoal(same.state, { framingKey: key, recenters: 0, doubleTap: request })
  assert.equal(again.resetMoved, false, 'two equal renders in a row never reset')
  const changed = cameraGoal(same.state, { framingKey: cameraFramingKey(close), recenters: 0, doubleTap: request })
  assert.equal(changed.state.doubleTap, null, 'a new framing clears the goal')
  assert.equal(changed.resetMoved, true)
  const back = cameraGoal(changed.state, { framingKey: key, recenters: 0, doubleTap: request })
  assert.equal(back.state.doubleTap, null, 'back at the home key the target is the framing, not the old goal, and the old request stays spent')
  const recentered = cameraGoal(same.state, { framingKey: key, recenters: 1, doubleTap: request })
  assert.equal(recentered.state.doubleTap, null, 'a recenter clears the goal')
  assert.equal(recentered.resetMoved, true)
  assert.equal(recentered.state.recenters, 1)
  const other: CameraFraming = { position: [6, 6, 6], target: [2, 2, 2], fov: 40 }
  const retapped = cameraGoal(recentered.state, { framingKey: key, recenters: 1, doubleTap: { id: 2, goal: other } })
  assert.equal(retapped.state.doubleTap, other, 'a newer double-tap after a recenter looks again')
  assert.equal(retapped.state.doubleTapId, 2)
  const raced = cameraGoal(same.state, { framingKey: cameraFramingKey(close), recenters: 0, doubleTap: { id: 2, goal: other } })
  assert.equal(raced.state.doubleTap, null, 'a framing change in the same render wins over a double-tap')
  assert.equal(raced.state.doubleTapId, 2, 'and spends it, so it never lands later')
  assert.equal(raced.resetMoved, true)
  assert.equal(cameraGoal(start, { framingKey: key, recenters: 0, doubleTap: null }).state, start, 'no request, no change')
}

function routerRig() {
  let clock = 0
  const pending: { at: number, fn: () => void, live: boolean }[] = []
  const pans: [number, number][] = []
  const zooms: number[] = []
  const router = createWheelRouter({
    now: () => clock,
    schedule: (fn, ms) => {
      const entry = { at: clock + ms, fn, live: true }
      pending.push(entry)
      return () => {
        entry.live = false
      }
    },
    onPan: (dx, dy) => pans.push([dx, dy]),
    onZoom: dy => zooms.push(dy),
  })
  const advance = (to: number) => {
    clock = to
    for (const entry of pending) {
      if (entry.live && entry.at <= clock) {
        entry.live = false
        entry.fn()
      }
    }
  }
  const wheel = (o: Partial<WheelSample & { ctrlKey: boolean, metaKey: boolean }>) =>
    router.wheel({ deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, timeStamp: clock, ctrlKey: false, metaKey: false, ...o })
  return { router, wheel, advance, pans, zooms }
}

{
  const r = routerRig()
  r.wheel({ deltaY: 100 })
  assert.deepEqual(r.zooms, [], 'an undecidable sample is held')
  r.advance(39)
  assert.deepEqual(r.zooms, [], 'and still held just before 40 ms')
  r.advance(40)
  assert.deepEqual(r.zooms, [100], 'then zoomed once at 40 ms, a mouse by default')
  r.advance(80)
  assert.deepEqual(r.zooms, [100])
  assert.deepEqual(r.pans, [])
}
{
  const r = routerRig()
  r.wheel({ deltaY: 4.000244140625 })
  assert.deepEqual(r.zooms, [4.000244140625], 'a real notch zooms with no wait')
}
{
  const r = routerRig()
  r.wheel({ deltaX: 2, deltaY: 3 })
  r.advance(16)
  r.wheel({ deltaX: 1, deltaY: 5 })
  assert.deepEqual(r.pans, [[2, 3], [1, 5]], 'a trackpad stream pans every sample')
  assert.deepEqual(r.zooms, [])
}
{
  const r = routerRig()
  r.wheel({ deltaY: 2 })
  r.advance(500)
  r.wheel({ deltaY: 4.000244140625 })
  assert.deepEqual(r.pans, [[0, 2]])
  assert.deepEqual(r.zooms, [4.000244140625], 'a stream after a 400 ms gap re-classifies')
}
{
  const r = routerRig()
  r.wheel({ deltaY: 2 })
  r.advance(500)
  r.wheel({ deltaY: 100 })
  r.advance(540)
  assert.deepEqual(r.pans, [[0, 2], [0, 100]], 'an undecidable new stream takes the last confident device')
}
{
  const r = routerRig()
  r.wheel({ deltaY: -30, ctrlKey: true })
  r.wheel({ deltaY: 7, metaKey: true })
  assert.deepEqual(r.zooms, [-30, 7], 'ctrl and meta zoom without classifying')
  assert.deepEqual(r.pans, [])
}
{
  const r = routerRig()
  r.wheel({ deltaX: 6, deltaY: 0, shiftKey: true })
  r.wheel({ deltaX: 0, deltaY: 9, shiftKey: true })
  assert.deepEqual(r.pans, [[6, 0], [9, 0]], 'Shift pans sideways')
}
{
  const r = routerRig()
  r.wheel({ deltaY: 100 })
  r.router.dispose()
  r.advance(100)
  assert.deepEqual(r.zooms, [], 'dispose before 40 ms fires nothing')
  assert.deepEqual(r.pans, [])
}

// A mouse notch, however large its delta, moves no more than OrbitControls' own 0.95 step; a pinch's small deltas follow it.
assert.ok(Math.abs(wheelZoomScale(100) - 1 / 0.95) < 1e-9, 'a notch out is one OrbitControls step')
assert.ok(Math.abs(wheelZoomScale(-120) - 0.95) < 1e-9, 'a notch in is one OrbitControls step')
assert.ok(Math.abs(wheelZoomScale(-2) - Math.exp(-2 * SCENE_GESTURES.wheel.zoomPerDelta)) < 1e-12, 'a small pinch delta is not capped')
assert.ok(Math.abs(wheelZoomScale(-2) * wheelZoomScale(2) - 1) < 1e-12, 'in and out by the same delta cancel')
assert.equal(wheelZoomScale(0), 1)

assert.equal(tapRingRemainingMs(1000, 1000), SCENE_GESTURES.tapRingMs, 'a fresh mark shows its whole ring')
assert.equal(tapRingRemainingMs(1000, 1200), SCENE_GESTURES.tapRingMs - 200, 'a late mount shows only what is left')
assert.equal(tapRingRemainingMs(1000, 1000 + SCENE_GESTURES.tapRingMs), 0, 'a spent mark shows nothing')
assert.equal(tapRingRemainingMs(1000, 60_000), 0, 'an old mark never replays')
assert.equal(tapRingRemainingMs(1000, 900), SCENE_GESTURES.tapRingMs, 'a clock behind the mark never lengthens the ring')

const { streamGapMs } = SCENE_GESTURES.wheel
assert.equal(startsWheelStream(null, 5000), true, 'the first wheel starts a stream')
assert.equal(startsWheelStream(5000, 5000 + streamGapMs), false, 'a wheel within the gap continues the stream')
assert.equal(startsWheelStream(5000, 5000 + streamGapMs + 1), true, 'a wheel past the gap starts a new stream')

console.log('✓ scene primitives')
