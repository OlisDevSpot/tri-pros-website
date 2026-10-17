import type { StoredFundingSource } from './derive-stored-funding-choice'
import type { SOW } from '@/shared/modules/proposals/core/types'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { deriveStoredFundingChoice } from './derive-stored-funding-choice'

function part(incentiveAmount?: number): SOW {
  const incentives = incentiveAmount ? [{ id: '00000000-0000-4000-8000-000000000001', label: 'Bundle', amount: incentiveAmount }] : []
  return { contentJSON: '', html: '', scopes: [], title: 'Roof', trade: { id: 't', label: 'Roofing' }, financials: { sectionPrice: null, costLines: [], incentives } }
}

function proposal(overrides: Partial<StoredFundingSource> = {}): StoredFundingSource {
  return {
    startingTcpCents: 3_000_000,
    depositAmountCents: null,
    cashInDealCents: 100_000,
    miscPriceCents: null,
    incentives: [],
    projectJSON: { data: { sow: [part()] } },
    financeOptionId: 7,
    ...overrides,
  }
}

describe('deriveStoredFundingChoice', () => {
  it('keeps a stored cash down already inside the bounds, so opening the page writes nothing', () => {
    const choice = deriveStoredFundingChoice(proposal({ cashInDealCents: 520_000 }))
    assert.equal(choice.finalTcp, 30000)
    assert.equal(choice.deposit, 1000)
    assert.equal(choice.allCash, false)
    assert.ok(Object.is(choice.cash, choice.storedCash))
    assert.equal(choice.financed, 24800)
    assert.equal(choice.selectedOptionId, 7)
  })

  it('pulls an old row below the deposit up to it, and one above the financing room down to it', () => {
    const below = deriveStoredFundingChoice(proposal({ cashInDealCents: 0 }))
    assert.equal(below.cash, 1000)
    assert.notEqual(below.cash, below.storedCash)
    const above = deriveStoredFundingChoice(proposal({ cashInDealCents: 2_800_000 }))
    assert.equal(above.cash, 26500)
    assert.equal(above.allCash, false)
  })

  it('reads a cash down of the whole price as all cash, also when the price has fractional cents', () => {
    const choice = deriveStoredFundingChoice(proposal({ cashInDealCents: 2_750_001, projectJSON: { data: { sow: [part(2499.99)] } } }))
    assert.equal(choice.allCash, true)
    assert.ok(Object.is(choice.cash, choice.storedCash))
    assert.equal(choice.financed, 0)
  })

  it('is all cash when the deposit alone leaves under the financing minimum', () => {
    const choice = deriveStoredFundingChoice(proposal({ startingTcpCents: 380_000, cashInDealCents: 38_000 }))
    assert.equal(choice.canFinance, false)
    assert.equal(choice.allCash, true)
    assert.equal(choice.cash, 3800)
  })

  it('carries the payment schedule, which sums to the price', () => {
    const { schedule, finalTcp } = deriveStoredFundingChoice(proposal({ projectJSON: { data: { sow: [part(2499.99)] } } }))
    const totalCents = schedule.reduce((sum, row) => sum + Math.round(row.amount * 100), 0)
    assert.equal(totalCents, Math.round(finalTcp * 100))
    assert.equal(schedule[0]?.key, 'deposit')
    assert.equal(schedule.length, 5)
  })
})
