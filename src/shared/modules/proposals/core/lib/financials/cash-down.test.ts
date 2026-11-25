import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { canFinance, clampFinancedCashDown, getCashDownPreset, getCashDownStops, getDefaultCashDown, isAllCash, isAllowedCashDown, nearestStopIndex, roundToCents } from './cash-down'

describe('getCashDownStops', () => {
  it('starts at the deposit, then every $200 up to the financing minimum', () => {
    assert.deepEqual(getCashDownStops(5100, 510), [510, 600, 800, 1000, 1200, 1400, 1600])
  })
  it('keeps a deposit that sits on the grid once', () => {
    assert.deepEqual(getCashDownStops(4700, 400).slice(0, 3), [400, 600, 800])
  })
  it('is the deposit alone when only it fits', () => {
    assert.deepEqual(getCashDownStops(4000, 400), [400])
  })
  it('is empty when the deposit alone leaves under $3,500 financed', () => {
    assert.deepEqual(getCashDownStops(3800, 380), [])
    assert.equal(canFinance(3800, 380), false)
  })
})

describe('bounds', () => {
  it('rounds a computed price to the cent', () => {
    assert.equal(roundToCents(30_000 - 2499.99), 27_500.01)
  })
  it('treats a cash down of the whole price as all cash, in cents', () => {
    assert.equal(isAllCash(22_000, 22_000.004), true)
    assert.equal(isAllCash(21_999.99, 22_000), false)
  })
  it('accepts the whole price or a value between the deposit and the price minus $3,500', () => {
    assert.equal(isAllowedCashDown(22_000, 22_000, 1000), true)
    assert.equal(isAllowedCashDown(1000, 22_000, 1000), true)
    assert.equal(isAllowedCashDown(18_500, 22_000, 1000), true)
    assert.equal(isAllowedCashDown(18_500.01, 22_000, 1000), false)
    assert.equal(isAllowedCashDown(999.99, 22_000, 1000), false)
  })
  it('clamps a stored financed amount without snapping it', () => {
    assert.equal(clampFinancedCashDown(1234, 22_000, 1000), 1234)
    assert.equal(clampFinancedCashDown(0, 22_000, 1000), 1000)
    assert.equal(clampFinancedCashDown(30_000, 22_000, 1000), 18_500)
  })
  it('defaults to the deposit, or the whole price when nothing can be financed', () => {
    assert.equal(getDefaultCashDown(22_000, 1000), 1000)
    assert.equal(getDefaultCashDown(3800, 380), 3800)
  })
})

describe('presets', () => {
  const stops = getCashDownStops(26_600, 1000)
  it('snaps a percent of the price to the nearest stop', () => {
    assert.deepEqual(getCashDownPreset(10, 26_600, stops), { value: 2600, disabled: false })
  })
  it('is disabled past the last stop', () => {
    assert.equal(getCashDownPreset(90, 26_600, stops).disabled, true)
  })
  it('finds the nearest stop index', () => {
    assert.equal(nearestStopIndex(1099, [1000, 1200]), 0)
    assert.equal(nearestStopIndex(1101, [1000, 1200]), 1)
  })
})
