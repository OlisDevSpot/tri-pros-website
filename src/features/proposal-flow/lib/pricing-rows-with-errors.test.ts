import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { pricingRowsWithErrors } from './pricing-rows-with-errors'

const err = { message: 'x', type: 'custom' }

describe('pricingRowsWithErrors', () => {
  it('no errors opens nothing', () => {
    assert.deepEqual(pricingRowsWithErrors(undefined), { incentives: false, costLines: false })
    assert.deepEqual(pricingRowsWithErrors({}), { incentives: false, costLines: false })
  })
  it('an incentive field error opens only the incentives row', () => {
    assert.deepEqual(pricingRowsWithErrors({ incentives: [undefined, { label: err }] }), { incentives: true, costLines: false })
  })
  it('a cost-line field error opens only the cost lines row', () => {
    assert.deepEqual(pricingRowsWithErrors({ costLines: [{ relatedScopeId: err }] }), { incentives: false, costLines: true })
  })
  it('a section price error opens neither summary row', () => {
    assert.deepEqual(pricingRowsWithErrors({ sectionPrice: err }), { incentives: false, costLines: false })
  })
  it('an array with only holes counts as no error', () => {
    assert.deepEqual(pricingRowsWithErrors({ incentives: [undefined] }), { incentives: false, costLines: false })
  })
})
