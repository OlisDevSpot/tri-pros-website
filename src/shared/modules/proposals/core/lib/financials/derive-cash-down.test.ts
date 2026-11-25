import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { deriveCreateCashDown, deriveEditCashDown } from './derive-cash-down'

describe('deriveCreateCashDown', () => {
  it('keeps a cash meeting deal all cash after the agent raises the price', () => {
    // The form's cash down was seeded with the meeting's $20,000; the agent priced the proposal at $24,500.
    assert.equal(deriveCreateCashDown({ finalTcp: 24_500, deposit: 1000, meetingDealIsCash: true }), 24_500)
  })
  it('starts a financed create at the deposit', () => {
    assert.equal(deriveCreateCashDown({ finalTcp: 7300, deposit: 730, meetingDealIsCash: false }), 730)
  })
  it('makes an unfinanceable create all cash', () => {
    // The $360 deposit alone leaves less than the $3,500 financing minimum to borrow.
    assert.equal(deriveCreateCashDown({ finalTcp: 3600, deposit: 360, meetingDealIsCash: false }), 3600)
  })
  it('rounds an all-cash price to the cent', () => {
    assert.equal(deriveCreateCashDown({ finalTcp: 30_000 - 2499.99, deposit: 1000, meetingDealIsCash: true }), 27_500.01)
  })
})

describe('deriveEditCashDown', () => {
  it('keeps an in-bounds cash down', () => {
    assert.equal(deriveEditCashDown({ storedCash: 2000, storedFinalTcp: 7300, nextFinalTcp: 8000, nextDeposit: 800 }), 2000)
  })
  it('keeps all cash all cash at the new price', () => {
    assert.equal(deriveEditCashDown({ storedCash: 7300, storedFinalTcp: 7300, nextFinalTcp: 9100, nextDeposit: 910 }), 9100)
  })
  it('clamps a cash down above the new financed maximum', () => {
    // $7,300 − $3,500 = $3,800 is the most a financed deal can put down.
    assert.equal(deriveEditCashDown({ storedCash: 4000, storedFinalTcp: 20_000, nextFinalTcp: 7300, nextDeposit: 730 }), 3800)
  })
  it('clamps a cash down below the new deposit up to it', () => {
    assert.equal(deriveEditCashDown({ storedCash: 500, storedFinalTcp: 5000, nextFinalTcp: 20_000, nextDeposit: 1000 }), 1000)
  })
  it('turns a financed deal all cash when the new price can no longer be financed', () => {
    assert.equal(deriveEditCashDown({ storedCash: 1000, storedFinalTcp: 20_000, nextFinalTcp: 3600, nextDeposit: 360 }), 3600)
  })
})
