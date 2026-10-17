import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/proposal-refusals'
import { cashDownRefusal, depositRefusal } from './funding-guards'

describe('depositRefusal', () => {
  it('passes a deposit at the cap of a $7,300 price', () => {
    assert.equal(depositRefusal(73_000, 730_000), null)
  })
  it('refuses a deposit one cent over the cap', () => {
    assert.equal(depositRefusal(73_001, 730_000), PROPOSAL_REFUSALS.depositOverCap)
  })
  it('holds the $1,000 cap on a large price', () => {
    assert.equal(depositRefusal(100_000, 5_000_000), null)
    assert.equal(depositRefusal(100_001, 5_000_000), PROPOSAL_REFUSALS.depositOverCap)
  })
  it('refuses any deposit when the price is unknown', () => {
    assert.equal(depositRefusal(1, null), PROPOSAL_REFUSALS.depositOverCap)
    assert.equal(depositRefusal(0, null), null)
  })
})

describe('cashDownRefusal', () => {
  const row = { finalTcpCents: 730_000, depositAmountCents: 73_000 }

  it('passes the highest financed cash down at $7,300 with a $730 deposit', () => {
    assert.equal(cashDownRefusal(380_000, row), null)
  })
  it('refuses one cent above the highest financed cash down', () => {
    assert.equal(cashDownRefusal(380_001, row), PROPOSAL_REFUSALS.invalidCashDown)
  })
  it('passes the deposit and refuses one cent below it', () => {
    assert.equal(cashDownRefusal(73_000, row), null)
    assert.equal(cashDownRefusal(72_999, row), PROPOSAL_REFUSALS.invalidCashDown)
  })
  it('always passes the whole price', () => {
    assert.equal(cashDownRefusal(730_000, row), null)
    assert.equal(cashDownRefusal(300_000, { finalTcpCents: 300_000, depositAmountCents: null }), null)
  })
  it('reads an empty deposit as the cap', () => {
    assert.equal(cashDownRefusal(73_000, { finalTcpCents: 730_000, depositAmountCents: null }), null)
    assert.equal(cashDownRefusal(72_999, { finalTcpCents: 730_000, depositAmountCents: null }), PROPOSAL_REFUSALS.invalidCashDown)
  })
})
