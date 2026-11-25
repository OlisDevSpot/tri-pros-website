import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { resolveBeforeAfterPairs } from './resolve-before-after-pairs'

const file = (id: number) => ({ id }) as never

describe('resolveBeforeAfterPairs', () => {
  it('resolves each pair against the project media', () => {
    const detail = { project: { beforeAfterPairsJSON: { pairs: [{ beforeMediaId: 1, afterMediaId: 2, label: 'Front', confidence: 0.9 }] } }, media: { all: [file(1), file(2)] } } as never
    assert.equal(resolveBeforeAfterPairs(detail).length, 1)
  })
  it('leads with the most confident pair', () => {
    const pairs = [{ beforeMediaId: 1, afterMediaId: 2, label: 'Side', confidence: 0.4 }, { beforeMediaId: 3, afterMediaId: 4, label: 'Front', confidence: 0.9 }]
    const detail = { project: { beforeAfterPairsJSON: { pairs } }, media: { all: [file(1), file(2), file(3), file(4)] } } as never
    assert.deepEqual(resolveBeforeAfterPairs(detail).map(p => p.label), ['Front', 'Side'])
  })
  it('drops a pair whose photo is gone', () => {
    const detail = { project: { beforeAfterPairsJSON: { pairs: [{ beforeMediaId: 1, afterMediaId: 9, label: 'Front', confidence: 0.9 }] } }, media: { all: [file(1)] } } as never
    assert.deepEqual(resolveBeforeAfterPairs(detail), [])
  })
  it('is empty with no pairs', () => {
    assert.deepEqual(resolveBeforeAfterPairs({ project: { beforeAfterPairsJSON: null }, media: { all: [] } } as never), [])
  })
})
