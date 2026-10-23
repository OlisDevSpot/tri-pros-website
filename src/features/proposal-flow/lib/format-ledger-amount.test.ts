import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { formatLedgerAmount } from './format-ledger-amount'

describe('formatLedgerAmount', () => {
  it('prints positives as plain dollars', () => {
    assert.equal(formatLedgerAmount(32880), '$32,880')
  })
  it('prints deductions with a true minus sign', () => {
    assert.equal(formatLedgerAmount(-1000), '−$1,000')
  })
  it('prints zero without a sign', () => {
    assert.equal(formatLedgerAmount(0), '$0')
    assert.equal(formatLedgerAmount(-0), '$0')
  })
})
