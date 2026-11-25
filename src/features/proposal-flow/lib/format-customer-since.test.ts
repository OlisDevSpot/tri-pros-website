import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { formatCustomerSince } from './format-customer-since'

describe('formatCustomerSince', () => {
  it('reads month and year in the business time zone', () => {
    assert.equal(formatCustomerSince('2026-03-14T18:00:00Z'), 'Customer since Mar 2026')
  })
  it('uses the business month at a UTC month boundary', () => {
    assert.equal(formatCustomerSince(new Date('2026-04-01T03:00:00Z')), 'Customer since Mar 2026')
  })
})
