import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { firstSowErrorTarget } from './sow-error-target'

const err = { message: 'x', type: 'custom' }

describe('firstSowErrorTarget', () => {
  it('cost-line error targets the pricing tab', () => {
    assert.deepEqual(
      firstSowErrorTarget({ project: { data: { sow: [undefined, { financials: { costLines: [{ relatedScopeId: err }] } }] } } }),
      { index: 1, tab: 'pricing' },
    )
  })
  it('content error targets the description tab', () => {
    assert.deepEqual(firstSowErrorTarget({ project: { data: { sow: [{ contentJSON: err }] } } }), { index: 0, tab: 'description' })
  })
  it('trade or scopes error opens the section without a tab', () => {
    assert.deepEqual(firstSowErrorTarget({ project: { data: { sow: [undefined, undefined, { trade: { id: err } }] } } }), { index: 2, tab: null })
  })
  it('no SOW error returns null', () => {
    assert.equal(firstSowErrorTarget({ funding: { depositAmount: err } }), null)
    assert.equal(firstSowErrorTarget({}), null)
  })
})
