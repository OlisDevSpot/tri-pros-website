import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enterStyle, exitStyle, TRANSITION_FRAMES, wipeEdge } from './transitions'

test('none and finished transitions are identity', () => {
  assert.deepEqual(enterStyle('none', 'left', 0), { opacity: 1, transform: 'none' })
  assert.deepEqual(enterStyle('fade', 'left', TRANSITION_FRAMES.fade), { opacity: 1, transform: 'none' })
  assert.deepEqual(exitStyle('fade', 'left', 3), { opacity: 1, transform: 'none' })
})

test('fade ramps opacity linearly over 10f', () => {
  assert.equal(enterStyle('fade', 'left', 0).opacity, 0)
  assert.equal(enterStyle('fade', 'left', 5).opacity, 0.5)
})

test('whip enter comes from the opposite side and exits with the motion', () => {
  const enter = enterStyle('whip', 'left', 0)
  assert.match(enter.transform, /translate\(110(\.\d+)?%/) // incoming starts fully right, moves left
  assert.equal(enter.filter, 'url(#whip-blur-x)')
  const exit = exitStyle('whip', 'left', TRANSITION_FRAMES.whip - 1)
  assert.match(exit.transform, /translate\(-\d/) // outgoing has moved left
})

test('wipe clips the incoming and reports its edge', () => {
  const mid = enterStyle('wipe', 'left', 7)
  assert.ok(mid.clipPath?.startsWith('inset('))
  assert.equal(wipeEdge('wipe', -1), null)
  assert.equal(wipeEdge('fade', 5), null)
  const edge = wipeEdge('wipe', 7)
  assert.ok(edge !== null && edge > 0 && edge < 100)
})

test('zoomPunch: incoming settles from 1.3, outgoing blows out past 1.3', () => {
  assert.match(enterStyle('zoomPunch', 'left', 0).transform, /scale\(1\.3\)/)
  const out = exitStyle('zoomPunch', 'left', TRANSITION_FRAMES.zoomPunch - 1)
  assert.match(out.transform, /scale\(1\.[3-9]/)
  assert.ok(out.opacity < 1)
})

test('wipe up/down clip from the correct edges and agree with wipeEdge', () => {
  // direction 'up': visible region grows from the TOP → bottom inset shrinks.
  // inset() is 4-value form: inset(top right bottom left)
  const up = enterStyle('wipe', 'up', 7)
  const edge = wipeEdge('wipe', 7)!
  assert.match(up.clipPath!, /^inset\(0 0 [\d.]+% 0\)$/) // bottom-inset form: inset(0 0 X% 0)
  const upInset = Number.parseFloat(up.clipPath!.match(/^inset\(0 0 ([\d.]+)% 0\)$/)![1]!)
  assert.ok(Math.abs(upInset - (100 - edge)) < 1e-6) // divider at top: edge% == visible height

  // direction 'down': visible region grows from the BOTTOM → top inset shrinks.
  const down = enterStyle('wipe', 'down', 7)
  assert.match(down.clipPath!, /^inset\([\d.]+% 0 0 0\)$/) // top-inset form: inset(X% 0 0 0)
  const downInset = Number.parseFloat(down.clipPath!.match(/^inset\(([\d.]+)% 0 0 0\)$/)![1]!)
  assert.ok(Math.abs(downInset - (100 - edge)) < 1e-6)

  // direction 'right': visible region grows from the LEFT → right inset shrinks.
  const right = enterStyle('wipe', 'right', 7)
  assert.match(right.clipPath!, /^inset\(0 0 0 [\d.]+%\)$/) // right-inset form: inset(0 0 0 X%)
  const rightInset = Number.parseFloat(right.clipPath!.match(/^inset\(0 0 0 ([\d.]+)%\)$/)![1]!)
  assert.ok(Math.abs(rightInset - (100 - edge)) < 1e-6)
})
