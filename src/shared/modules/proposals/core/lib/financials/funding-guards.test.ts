import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/proposal-refusals'
import { cashDownRefusal, depositRefusal, depositWithinCapOrNull, fundingValuesToCheck, writeMovesPrice } from './funding-guards'

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

describe('depositWithinCapOrNull', () => {
  it('keeps a copied deposit within the cap', () => {
    assert.equal(depositWithinCapOrNull(73_000, 730_000), 73_000)
  })
  it('drops a copied deposit above the cap, so the copy follows the cap', () => {
    assert.equal(depositWithinCapOrNull(100_000, 730_000), null)
  })
  it('keeps an empty deposit empty', () => {
    assert.equal(depositWithinCapOrNull(null, 730_000), null)
  })
  it('drops a deposit when the source has no price rollup', () => {
    assert.equal(depositWithinCapOrNull(50_000, null), null)
  })
})

describe('writeMovesPrice', () => {
  it('ignores a price key sent as undefined', () => {
    assert.equal(writeMovesPrice({ cashInDealCents: 100, projectJSON: undefined }), false)
    assert.equal(writeMovesPrice({ startingTcpCents: undefined }), false)
  })
  it('sees a real price move', () => {
    assert.equal(writeMovesPrice({ startingTcpCents: 730_000 }), true)
    assert.equal(writeMovesPrice({ projectJSON: { data: {} } }), true)
  })
})

describe('fundingValuesToCheck', () => {
  it('checks a cash down sent beside an undefined price key', () => {
    assert.deepEqual(fundingValuesToCheck({ cashInDealCents: 100, projectJSON: undefined }), { depositAmountCents: null, cashInDealCents: 100 })
  })
  it('checks an empty cash down as $0', () => {
    assert.deepEqual(fundingValuesToCheck({ cashInDealCents: null }), { depositAmountCents: null, cashInDealCents: 0 })
  })
  it('checks a plain cash write', () => {
    assert.deepEqual(fundingValuesToCheck({ cashInDealCents: 380_000 }), { depositAmountCents: null, cashInDealCents: 380_000 })
  })
  it('leaves a write that moves the price to the edit view', () => {
    assert.deepEqual(fundingValuesToCheck({ cashInDealCents: 100, depositAmountCents: 999_999, startingTcpCents: 730_000 }), { depositAmountCents: null, cashInDealCents: null })
  })
  it('checks a deposit and leaves an empty one, which means the cap', () => {
    assert.deepEqual(fundingValuesToCheck({ depositAmountCents: 73_001, projectJSON: undefined }), { depositAmountCents: 73_001, cashInDealCents: null })
    assert.deepEqual(fundingValuesToCheck({ depositAmountCents: null }), { depositAmountCents: null, cashInDealCents: null })
  })
  it('checks nothing when no funding value is written', () => {
    assert.deepEqual(fundingValuesToCheck({}), { depositAmountCents: null, cashInDealCents: null })
  })
})

describe('an empty cash down is held to the bound', () => {
  it('refuses $0 on a financed proposal', () => {
    const { cashInDealCents } = fundingValuesToCheck({ cashInDealCents: null })
    assert.equal(cashDownRefusal(cashInDealCents!, { finalTcpCents: 730_000, depositAmountCents: 73_000 }), PROPOSAL_REFUSALS.invalidCashDown)
  })
})
