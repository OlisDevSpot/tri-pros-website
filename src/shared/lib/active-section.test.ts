import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { activeSectionAt, isScrolledToBottom, trackingLine } from './active-section'

const sections = [
  { id: 'a', top: -900 },
  { id: 'b', top: -40 },
  { id: 'c', top: 120 },
  { id: 'd', top: 700 },
]

describe('trackingLine', () => {
  it('sits at the ratio of the root below the sticky offset', () => {
    assert.equal(trackingLine({ rootTop: 0, clientHeight: 1000, offset: 0, ratio: 0.3 }), 300)
    assert.equal(trackingLine({ rootTop: 100, clientHeight: 856, offset: 56, ratio: 0.3 }), 396)
  })
})

describe('activeSectionAt', () => {
  it('picks the last section whose top has crossed the line', () => {
    assert.equal(activeSectionAt(sections, 300, false), 'c')
    assert.equal(activeSectionAt(sections, 0, false), 'b')
  })
  it('keeps a short section that has crossed the line over a tall one still covering it', () => {
    const tallThenShort = [{ id: 'tall', top: -2000 }, { id: 'short', top: 280 }, { id: 'next', top: 420 }]
    assert.equal(activeSectionAt(tallThenShort, 300, false), 'short')
  })
  it('falls back to the first section before any top crosses the line', () => {
    assert.equal(activeSectionAt([{ id: 'a', top: 400 }, { id: 'b', top: 900 }], 300, false), 'a')
  })
  it('counts a top exactly on the line as crossed', () => {
    assert.equal(activeSectionAt([{ id: 'a', top: 0 }, { id: 'b', top: 300 }], 300, false), 'b')
  })
  it('skips sections that are not rendered', () => {
    assert.equal(activeSectionAt([{ id: 'a', top: -10 }, { id: 'b', top: null }, { id: 'c', top: 900 }], 300, false), 'a')
  })
  it('gives the last section the win at the bottom of the root', () => {
    assert.equal(activeSectionAt(sections, 300, true), 'd')
  })
  it('is empty with no sections', () => {
    assert.equal(activeSectionAt([], 300, false), '')
    assert.equal(activeSectionAt([], 300, true), '')
  })
})

describe('isScrolledToBottom', () => {
  it('allows two pixels of rounding', () => {
    assert.equal(isScrolledToBottom({ scrollTop: 998, clientHeight: 1000, scrollHeight: 2000 }), true)
    assert.equal(isScrolledToBottom({ scrollTop: 997, clientHeight: 1000, scrollHeight: 2000 }), false)
  })
  it('is false for a root that does not scroll at the top', () => {
    assert.equal(isScrolledToBottom({ scrollTop: 0, clientHeight: 1000, scrollHeight: 3000 }), false)
  })
})
