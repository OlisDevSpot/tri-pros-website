import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'

import { allPhases, foldScrollDelta, isEveryPhaseOpen, togglePhase } from './scope-phase-open'

describe('allPhases', () => {
  it('opens every index', () => {
    assert.deepEqual(allPhases(3), new Set([0, 1, 2]))
  })

  it('is empty for no phases', () => {
    assert.equal(allPhases(0).size, 0)
  })
})

describe('togglePhase', () => {
  it('closes an open phase and reopens it without mutating the input', () => {
    const open = new Set([0, 1, 2])
    const closed = togglePhase(open, 1)
    assert.deepEqual(closed, new Set([0, 2]))
    assert.deepEqual(open, new Set([0, 1, 2]))
    assert.deepEqual(togglePhase(closed, 1), new Set([0, 1, 2]))
  })
})

describe('isEveryPhaseOpen', () => {
  it('compares against the phase count', () => {
    assert.equal(isEveryPhaseOpen(new Set([0, 1, 2]), 3), true)
    assert.equal(isEveryPhaseOpen(new Set([0, 2]), 3), false)
    assert.equal(isEveryPhaseOpen(new Set(), 0), true)
  })
})

describe('foldScrollDelta', () => {
  it('pulls a row that passed its sticky line back to it', () => {
    assert.equal(foldScrollDelta(40, 120), -80)
  })

  it('is zero at or below the sticky line', () => {
    assert.equal(foldScrollDelta(120, 120), 0)
    assert.equal(foldScrollDelta(300, 120), 0)
  })
})
