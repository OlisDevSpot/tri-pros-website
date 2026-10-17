import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { getDepositCap, resolveDeposit } from './deposit'

describe('getDepositCap', () => {
  it('is $1,000 at and above a $10,000 price', () => {
    assert.equal(getDepositCap(10_000), 1000)
    assert.equal(getDepositCap(48_200), 1000)
  })
  it('is 10% below $10,000, floored to the cent', () => {
    assert.equal(getDepositCap(7300), 730)
    assert.equal(getDepositCap(7300.55), 730.05)
  })
  it('is never negative', () => {
    assert.equal(getDepositCap(-5), 0)
  })
})

describe('resolveDeposit', () => {
  it('uses the cap when nothing is stored', () => {
    assert.equal(resolveDeposit(null, 7300), 730)
  })
  it('keeps a stored override under the cap', () => {
    assert.equal(resolveDeposit(500, 14_500), 500)
  })
  it('pulls a stored value above the cap back to the cap', () => {
    assert.equal(resolveDeposit(1000, 7300), 730)
  })
})
