import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorPopSaturation, screenShakeOffset } from './accents'

test('color pop: normal → desaturated hold → snap back over 3f', () => {
  assert.equal(colorPopSaturation(0, [100]), 1) // before the hold window
  assert.equal(colorPopSaturation(60, [100]), 0.25) // inside the 45f hold
  assert.equal(colorPopSaturation(100, [100]), 0.25) // snap starts ON the frame
  assert.ok(colorPopSaturation(102, [100]) > 0.6) // mid-snap
  assert.equal(colorPopSaturation(103, [100]), 1) // done
  assert.equal(colorPopSaturation(50, []), 1)
})

test('screen shake: zero outside the window, bounded and decaying inside, deterministic', () => {
  assert.deepEqual(screenShakeOffset(10, [{ frame: 100, intensity: 1 }]), { x: 0, y: 0 })
  const early = screenShakeOffset(101, [{ frame: 100, intensity: 1 }])
  assert.ok(Math.abs(early.x) <= 10 && Math.abs(early.y) <= 10)
  assert.ok(Math.abs(early.x) + Math.abs(early.y) > 0)
  // deterministic: same frame → same offset
  assert.deepEqual(early, screenShakeOffset(101, [{ frame: 100, intensity: 1 }]))
  // decays: frame 109 amplitude ceiling is 1/10th of frame 100's
  const late = screenShakeOffset(109, [{ frame: 100, intensity: 1 }])
  assert.ok(Math.abs(late.x) <= 1.01 && Math.abs(late.y) <= 1.01)
  assert.deepEqual(screenShakeOffset(110, [{ frame: 100, intensity: 1 }]), { x: 0, y: 0 })
})
