import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import {
  insertIntoOpenSet,
  insertIntoTabMap,
  openSection,
  removeFromOpenSet,
  removeFromTabMap,
  toggleSection,
} from './sow-open-sections'

const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b)
const entries = <V>(map: Map<number, V>) => [...map.entries()].sort(([a], [b]) => a - b)

describe('removeFromOpenSet', () => {
  it('drops the removed index and shifts later ones down', () => {
    assert.deepEqual(sorted(removeFromOpenSet(new Set([0, 2, 3]), 2)), [0, 2])
  })
  it('keeps earlier indexes', () => {
    assert.deepEqual(sorted(removeFromOpenSet(new Set([0, 1]), 3)), [0, 1])
  })
  it('removing the only open section empties the set', () => {
    assert.deepEqual(sorted(removeFromOpenSet(new Set([1]), 1)), [])
  })
})

describe('removeFromTabMap', () => {
  it('drops the removed key and shifts later keys down with their tabs', () => {
    const map = new Map([[0, 'pricing'], [1, 'description'], [2, 'pricing']] as const)
    assert.deepEqual(entries(removeFromTabMap(map, 1)), [[0, 'pricing'], [1, 'pricing']])
  })
})

describe('insertIntoOpenSet', () => {
  it('shifts indexes at or after the insert position up', () => {
    assert.deepEqual(sorted(insertIntoOpenSet(new Set([0, 1, 3]), 1)), [0, 2, 4])
  })
})

describe('insertIntoTabMap', () => {
  it('leaves the new index without a tab (it opens on the default)', () => {
    const map = new Map([[0, 'pricing'], [1, 'pricing']] as const)
    const next = insertIntoTabMap(map, 1)
    assert.deepEqual(entries(next), [[0, 'pricing'], [2, 'pricing']])
    assert.equal(next.has(1), false)
  })
})

describe('openSection', () => {
  it('adds to the set when several may be open', () => {
    assert.deepEqual(sorted(openSection(new Set([0]), 2, false)), [0, 2])
  })
  it('replaces the set when one may be open', () => {
    assert.deepEqual(sorted(openSection(new Set([0, 3]), 2, true)), [2])
  })
  it('does not mutate its input', () => {
    const prev = new Set([0])
    openSection(prev, 1, false)
    assert.deepEqual(sorted(prev), [0])
  })
})

describe('toggleSection', () => {
  it('closes an open section', () => {
    assert.deepEqual(sorted(toggleSection(new Set([0, 1]), 1, false)), [0])
    assert.deepEqual(sorted(toggleSection(new Set([1]), 1, true)), [])
  })
  it('opens beside others when several may be open', () => {
    assert.deepEqual(sorted(toggleSection(new Set([0]), 1, false)), [0, 1])
  })
  it('opening closes the others when one may be open', () => {
    assert.deepEqual(sorted(toggleSection(new Set([0]), 1, true)), [1])
  })
})
