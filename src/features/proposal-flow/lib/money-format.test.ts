import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { pickMoneyFormat } from './money-format'

describe('pickMoneyFormat', () => {
  it('shows whole dollars when every amount is whole', () => {
    assert.equal(pickMoneyFormat([19200, 1000, 15500])(1000), '$1,000')
  })
  it('shows cents on every amount once one has cents', () => {
    const format = pickMoneyFormat([20000.01, 500.5])
    assert.equal(format(500.5), '$500.50')
    assert.equal(format(1000), '$1,000.00')
  })
  it('treats float noise from cent arithmetic as whole', () => {
    assert.equal(pickMoneyFormat([30000 - 2500.0000000000005])(27500), '$27,500')
  })
})
