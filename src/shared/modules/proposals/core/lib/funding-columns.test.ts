import type { SOW } from '@/shared/modules/proposals/core/types'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { buildPricingBreakdown } from './financials'
import { fundingDomainToColumns, toFundingInputs } from './funding-columns'

function section(title: string, sectionPrice: number | null, incentives: SOW['financials']['incentives'] = []): SOW {
  return { contentJSON: '', html: '', scopes: [], title, trade: { id: 't', label: 'Roofing' }, financials: { sectionPrice, costLines: [], incentives } }
}

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

describe('total-mode parts', () => {
  const sow = [
    section('Roof', null, [{ id: '00000000-0000-4000-8000-000000000001', label: '', amount: 250 }]),
    section('', null),
  ]
  it('lists every part with its incentives in total mode, and none in breakdown mode', () => {
    const total = buildPricingBreakdown({ funding: toFundingInputs(row), sow, priceDisplayMode: 'total' })
    assert.deepEqual(total.totalModeParts, [
      { key: '0-Roof', title: 'Roof', incentives: [{ id: '00000000-0000-4000-8000-000000000001', label: 'Discount', amount: 250 }] },
      { key: '1-section', title: 'Section 2', incentives: [] },
    ])
    assert.deepEqual(total.sections, [])
    assert.deepEqual(buildPricingBreakdown({ funding: toFundingInputs(row), sow, priceDisplayMode: 'breakdown' }).totalModeParts, [])
  })
})
