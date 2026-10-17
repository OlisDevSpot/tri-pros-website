import type { StoredFundingSource } from './derive-stored-funding-choice'
import type { SOW } from '@/shared/modules/proposals/core/types'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { getLoanValues } from '@/shared/lib/loan-calculations'
import { deriveChoiceTiles } from './derive-choice-tiles'
import { deriveStoredFundingChoice } from './derive-stored-funding-choice'

const sow: SOW = { contentJSON: '', html: '', scopes: [], title: 'Roof', trade: { id: 't', label: 'Roofing' }, financials: { sectionPrice: null, costLines: [], incentives: [] } }

function proposal(overrides: Partial<StoredFundingSource> = {}): StoredFundingSource {
  return {
    startingTcpCents: 3_000_000,
    depositAmountCents: null,
    cashInDealCents: 520_000,
    miscPriceCents: null,
    incentives: [],
    projectJSON: { data: { sow: [sow] } },
    financeOptionId: 7,
    ...overrides,
  }
}

const term = { termInMonths: 180, interestRate: 0.0999 }

describe('deriveChoiceTiles', () => {
  it('shows a financed choice as plan, cash down, term and monthly', () => {
    const choice = deriveStoredFundingChoice(proposal(), 'editable')
    const monthly = getLoanValues(24_800, 0.0999, 180).monthly
    assert.deepEqual(deriveChoiceTiles(choice, term), [
      { label: 'Plan', value: 'Financed' },
      { label: 'Cash down', value: '$5,200' },
      { label: 'Term', value: '15 years' },
      { label: 'Monthly', value: `$${monthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    ])
  })

  it('says the term is not picked, with no monthly, when no loan term is stored', () => {
    const tiles = deriveChoiceTiles(deriveStoredFundingChoice(proposal({ financeOptionId: null }), 'editable'), null)
    assert.deepEqual(tiles.slice(2), [{ label: 'Term', value: 'Not picked' }, { label: 'Monthly', value: '—' }])
  })

  it('shows all cash as plan, price, deposit and the payments after it', () => {
    const tiles = deriveChoiceTiles(deriveStoredFundingChoice(proposal({ cashInDealCents: 3_000_000 }), 'editable'), term)
    assert.deepEqual(tiles, [
      { label: 'Plan', value: 'All cash' },
      { label: 'Price', value: '$30,000' },
      { label: 'Deposit', value: '$1,000' },
      { label: 'Then', value: '4 payments' },
    ])
  })

  it('shows a frozen proposal’s cash down as saved, even below today’s deposit', () => {
    const tiles = deriveChoiceTiles(deriveStoredFundingChoice(proposal({ cashInDealCents: 0 }), 'saved'), term)
    assert.deepEqual(tiles[1], { label: 'Cash down', value: '$0' })
  })

  it('shows cents on every amount once one has them', () => {
    const tiles = deriveChoiceTiles(deriveStoredFundingChoice(proposal({ cashInDealCents: 520_050 }), 'editable'), null)
    assert.equal(tiles[1]?.value, '$5,200.50')
  })
})
