import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { fin, sec } from './price-fixtures'
import { sectionPriceDisplay, summarizeSowPrices } from './section-price'

describe('sectionPriceDisplay', () => {
  it('struck when a section incentive moves the price', () => {
    assert.deepEqual(sectionPriceDisplay(fin({ sectionPrice: 26980, incentives: [8350] }), 'breakdown'), { starting: 26980, final: 18630, struck: true })
  })
  it('not struck without incentives', () => {
    assert.deepEqual(sectionPriceDisplay(fin({ sectionPrice: 14250 }), 'breakdown'), { starting: 14250, final: 14250, struck: false })
  })
  it('total mode shows no price', () => {
    assert.deepEqual(sectionPriceDisplay(fin({ sectionPrice: null, incentives: [200] }), 'total'), { starting: null, final: null, struck: false })
  })
  it('a $0 price shows nothing', () => {
    assert.deepEqual(sectionPriceDisplay(fin({ sectionPrice: 0 }), 'breakdown'), { starting: 0, final: null, struck: false })
  })
  it('a null price shows nothing in breakdown mode', () => {
    assert.deepEqual(sectionPriceDisplay(fin({ sectionPrice: null }), 'breakdown'), { starting: null, final: null, struck: false })
  })
})

describe('summarizeSowPrices', () => {
  it('sums starting and final across sections', () => {
    assert.deepEqual(summarizeSowPrices([sec(26980, [8350]), sec(14250), sec(null)], 'breakdown'), { count: 3, starting: 41230, final: 32880, struck: true })
  })
  it('is not struck when nothing moves the price', () => {
    assert.deepEqual(summarizeSowPrices([sec(1000), sec(2000)], 'breakdown'), { count: 2, starting: 3000, final: 3000, struck: false })
  })
  it('total mode keeps the count and no price', () => {
    assert.deepEqual(summarizeSowPrices([sec(1000, [100])], 'total'), { count: 1, starting: null, final: null, struck: false })
  })
})
