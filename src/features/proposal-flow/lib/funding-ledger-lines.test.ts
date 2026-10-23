import type { PriceDisplayMode } from '@/shared/constants/enums'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { fundingLedgerLines } from './funding-ledger-lines'
import { sec, values } from './price-fixtures'

describe('fundingLedgerLines', () => {
  it('breakdown folds section incentives into the Scope of Work line', () => {
    const lines = fundingLedgerLines(values({ sow: [sec(26980, [8350]), sec(14250)], misc: 0, discounts: [1000] }), 'breakdown')
    assert.deepEqual(lines.map(l => [l.key, l.amount]), [['scopeOfWork', 32880], ['misc', 0], ['subtotal', 32880], ['incentives', -1000], ['price', 31880]])
    assert.equal(lines[0].sub, '2 sections · final prices')
  })
  it('singular section count', () => {
    assert.equal(fundingLedgerLines(values({ sow: [sec(100)] }), 'breakdown')[0].sub, '1 section · final prices')
  })
  it('an unpriced section\'s incentives still come off Scope of Work', () => {
    const lines = fundingLedgerLines(values({ sow: [sec(10000), sec(null, [500])], misc: 0, discounts: [] }), 'breakdown')
    assert.deepEqual(lines.map(l => [l.key, l.amount]), [['scopeOfWork', 9500], ['misc', 0], ['subtotal', 9500], ['incentives', 0], ['price', 9500]])
    assert.ok(lines.every(l => !Object.is(l.amount, -0)))
  })
  it('the $0 clamp is flagged, not hidden', () => {
    const price = fundingLedgerLines(values({ sow: [sec(1000)], misc: 0, discounts: [1500] }), 'breakdown').at(-1)!
    assert.deepEqual([price.amount, price.clamped], [0, true])
  })
  it('an unclamped price carries no clamp flag', () => {
    assert.equal(fundingLedgerLines(values({ sow: [sec(1000)], discounts: [500] }), 'breakdown').at(-1)!.clamped, undefined)
  })
  it('total mode keeps a Section incentives line when any exist', () => {
    const keys = fundingLedgerLines(values({ sow: [sec(null, [200])], startingTcp: 50000, discounts: [] }), 'total').map(l => l.key)
    assert.deepEqual(keys, ['tcp', 'sectionIncentives', 'incentives', 'price'])
  })
  it('total mode omits Section incentives when there are none', () => {
    const keys = fundingLedgerLines(values({ sow: [sec(null)], startingTcp: 50000 }), 'total').map(l => l.key)
    assert.deepEqual(keys, ['tcp', 'incentives', 'price'])
  })
  it('lines always add up to computeFinalTcp', () => {
    const fixtures: { mode: PriceDisplayMode, v: ReturnType<typeof values> }[] = [
      { mode: 'breakdown', v: values({ sow: [sec(26980, [8350]), sec(14250)], misc: 500, discounts: [1000] }) },
      { mode: 'breakdown', v: values({ sow: [sec(10000), sec(null, [500])] }) },
      { mode: 'breakdown', v: values({ sow: [sec(1000)], discounts: [1500] }) },
      { mode: 'total', v: values({ sow: [sec(null, [200])], startingTcp: 50000, discounts: [1000] }) },
      { mode: 'total', v: values({ sow: [sec(null)], startingTcp: 30000 }) },
      { mode: 'total', v: values({ sow: [sec(null, [900])], startingTcp: 100, discounts: [50] }) },
    ]
    for (const { mode, v } of fixtures) {
      const lines = fundingLedgerLines(v, mode)
      const amount = (key: string) => {
        const line = lines.find(l => l.key === key)
        assert.ok(line, `missing ${key} line`)
        return line.amount
      }
      const price = amount('price')
      assert.equal(price, computeFinalTcp({ funding: v.funding, sow: v.sow }))
      if (lines.at(-1)!.clamped) {
        assert.equal(price, 0)
        continue
      }
      if (mode === 'breakdown') {
        assert.equal(amount('subtotal') + amount('incentives'), price)
        assert.equal(amount('scopeOfWork') + amount('misc'), amount('subtotal'))
      }
      else {
        const sectionLine = lines.some(l => l.key === 'sectionIncentives') ? amount('sectionIncentives') : 0
        assert.equal(amount('tcp') + sectionLine + amount('incentives'), price)
      }
    }
  })
})
