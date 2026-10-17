import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { computePaymentSchedule } from './payment-schedule'

describe('computePaymentSchedule', () => {
  it('matches the contract example (TCP 14,500, deposit 500)', () => {
    const rows = computePaymentSchedule(14_500, 500)
    assert.deepEqual(rows.map(r => r.amount), [500, 2800, 4900, 4900, 1400])
    assert.deepEqual(rows.map(r => r.percent), [null, 20, 35, 35, 10])
    assert.deepEqual(rows.map(r => r.due), ['signing', 'stage', 'stage', 'stage', 'completion'])
  })
  it('always sums to the price, the remainder absorbing the cents', () => {
    const rows = computePaymentSchedule(10_000.01, 1000)
    const total = rows.reduce((sum, r) => sum + Math.round(r.amount * 100), 0)
    assert.equal(total, 1_000_001)
  })
})
