import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { buildPricingBreakdown } from './financials'
import { fundingDomainToColumns, toFundingInputs } from './funding-columns'

const row = { startingTcpCents: 730_000, depositAmountCents: null, cashInDealCents: 73_000, miscPriceCents: null, incentives: [] }

describe('deposit columns', () => {
  it('reads an empty deposit as null', () => {
    assert.equal(toFundingInputs(row).depositAmount, null)
  })
  it('writes null back as null', () => {
    assert.equal(fundingDomainToColumns({ startingTcp: 7300, depositAmount: null, cashInDeal: 730 }).depositAmountCents, null)
  })
  it('resolves the deposit in the breakdown', () => {
    const breakdown = buildPricingBreakdown({ funding: toFundingInputs(row), sow: [], priceDisplayMode: 'total' })
    assert.equal(breakdown.deposit, 730)
  })
})
