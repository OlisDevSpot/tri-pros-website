import type { StoredFundingSource } from './derive-stored-funding-choice'
import type { SOW } from '@/shared/modules/proposals/core/types'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { cashDownRefusal } from '@/shared/modules/proposals/core/lib/financials'
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

describe('deriveStoredFundingChoice, editable view (an open proposal)', () => {
  it('keeps a stored cash down already inside the bounds, so opening the page writes nothing', () => {
    const choice = deriveStoredFundingChoice(proposal({ cashInDealCents: 520_000 }), 'editable')
    assert.equal(choice.finalTcp, 30000)
    assert.equal(choice.deposit, 1000)
    assert.equal(choice.allCash, false)
    assert.ok(Object.is(choice.cash, choice.storedCash))
    assert.equal(choice.financed, 24800)
    assert.equal(choice.selectedOptionId, 7)
  })

  it('pulls an old row below the deposit up to it, and one above the financing room down to it', () => {
    const below = deriveStoredFundingChoice(proposal({ cashInDealCents: 0 }), 'editable')
    assert.equal(below.cash, 1000)
    assert.notEqual(below.cash, below.storedCash)
    const above = deriveStoredFundingChoice(proposal({ cashInDealCents: 2_800_000 }), 'editable')
    assert.equal(above.cash, 26500)
    assert.equal(above.allCash, false)
  })

  it('reads a cash down of the whole price as all cash, also when the price has fractional cents', () => {
    const choice = deriveStoredFundingChoice(proposal({ cashInDealCents: 2_750_001, projectJSON: { data: { sow: [part(2499.99)] } } }), 'editable')
    assert.equal(choice.allCash, true)
    assert.ok(Object.is(choice.cash, choice.storedCash))
    assert.equal(choice.financed, 0)
  })

  it('is all cash when the deposit alone leaves under the financing minimum', () => {
    const choice = deriveStoredFundingChoice(proposal({ startingTcpCents: 380_000, cashInDealCents: 38_000 }), 'editable')
    assert.equal(choice.canFinance, false)
    assert.equal(choice.allCash, true)
    assert.equal(choice.cash, 3800)
  })

  it('carries the payment schedule, which sums to the price', () => {
    const { schedule, finalTcp } = deriveStoredFundingChoice(proposal({ projectJSON: { data: { sow: [part(2499.99)] } } }), 'editable')
    const totalCents = schedule.reduce((sum, row) => sum + Math.round(row.amount * 100), 0)
    assert.equal(totalCents, Math.round(finalTcp * 100))
    assert.equal(schedule[0]?.key, 'deposit')
    assert.equal(schedule.length, 5)
  })
})

describe('deriveStoredFundingChoice, saved view (a frozen proposal)', () => {
  it('shows an old $0-down agreement as stored, not pulled up to the deposit', () => {
    const choice = deriveStoredFundingChoice(proposal({ cashInDealCents: 0 }), 'saved')
    assert.equal(choice.cash, 0)
    assert.equal(choice.allCash, false)
    assert.equal(choice.financed, 30000)
  })

  it('keeps a cash down above today’s financing room as stored', () => {
    const choice = deriveStoredFundingChoice(proposal({ cashInDealCents: 2_800_000 }), 'saved')
    assert.equal(choice.cash, 28000)
    assert.equal(choice.financed, 2000)
  })

  it('reads all cash from the stored value only, even below the financing minimum', () => {
    assert.equal(deriveStoredFundingChoice(proposal({ startingTcpCents: 380_000, cashInDealCents: 380_000 }), 'saved').allCash, true)
    const partial = deriveStoredFundingChoice(proposal({ startingTcpCents: 380_000, cashInDealCents: 38_000 }), 'saved')
    assert.equal(partial.allCash, false)
    assert.equal(partial.cash, 380)
  })

  it('matches the editable view whenever the stored value is already in bounds', () => {
    const source = proposal({ cashInDealCents: 520_000 })
    assert.deepEqual(deriveStoredFundingChoice(source, 'saved'), deriveStoredFundingChoice(source, 'editable'))
  })
})

// The editable value is what the page saves: the server's own check must accept every one, or the save would loop on refusals.
describe('the editable cash down passes the server’s bound', () => {
  const cases: Partial<StoredFundingSource>[] = [
    { cashInDealCents: 520_000 },
    { cashInDealCents: 0 },
    { cashInDealCents: 2_800_000 },
    { cashInDealCents: 2_999_999 },
    { cashInDealCents: 9_000_000 },
    { cashInDealCents: 2_750_001, projectJSON: { data: { sow: [part(2499.99)] } } },
    { cashInDealCents: 0, projectJSON: { data: { sow: [part(2499.99)] } } },
    { cashInDealCents: 1_234_567, depositAmountCents: 50_050, projectJSON: { data: { sow: [part(2499.99)] } } },
    { startingTcpCents: 380_000, cashInDealCents: 38_000 },
    { startingTcpCents: 450_001, cashInDealCents: 100 },
  ]
  for (const overrides of cases) {
    it(`accepts ${JSON.stringify({ ...overrides, projectJSON: undefined })}`, () => {
      const source = proposal(overrides)
      const choice = deriveStoredFundingChoice(source, 'editable')
      const row = { finalTcpCents: Math.round(choice.finalTcp * 100), depositAmountCents: source.depositAmountCents }
      assert.equal(cashDownRefusal(Math.round(choice.cash * 100), row), null)
    })
  }
})
