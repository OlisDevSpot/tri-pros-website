import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { sec } from './price-fixtures'
import { scopeOfWorkRows } from './scope-of-work-rows'

function titled(title: string, tradeLabel: string, ...rest: Parameters<typeof sec>) {
  const s = sec(...rest)
  return { ...s, title, trade: { ...s.trade, label: tradeLabel } }
}

describe('scopeOfWorkRows', () => {
  it('lists each section with its struck and final price and its incentives', () => {
    const rows = scopeOfWorkRows([titled('Kitchen', 'Remodel', 26980, [5000, 3350]), titled('Roof', 'Roofing', 14250)], 'breakdown')
    assert.deepEqual(rows.map(r => [r.title, r.price, r.incentives]), [
      ['Kitchen', { starting: 26980, final: 18630, struck: true }, '−$8,350 section incentives'],
      ['Roof', { starting: 14250, final: 14250, struck: false }, null],
    ])
  })
  it('falls back to the trade name, then to the proposal view\'s own placeholder', () => {
    const rows = scopeOfWorkRows([titled('  ', 'Roofing', 100), titled('', '', 100)], 'breakdown')
    assert.deepEqual(rows.map(r => r.title), ['Roofing', 'Untitled part'])
  })
  it('an unpriced section still lists its incentives', () => {
    const [row] = scopeOfWorkRows([titled('Deck', 'Decks', null, [500])], 'breakdown')
    assert.deepEqual([row.price.final, row.incentives], [null, '−$500 section incentives'])
  })
})
