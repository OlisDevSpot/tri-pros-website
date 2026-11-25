import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { gateCustomerPhone } from './gate-customer-phone'

const view = (hasSentProposal: boolean) => ({ customer: { phone: '8184707656', hasSentProposal } })

describe('gateCustomerPhone', () => {
  it('hides the phone from an agent before any proposal is sent', () => {
    assert.equal(gateCustomerPhone(view(false), false).customer?.phone, null)
  })
  it('shows it once a proposal is sent, or to an ungated reader', () => {
    assert.equal(gateCustomerPhone(view(true), false).customer?.phone, '8184707656')
    assert.equal(gateCustomerPhone(view(false), true).customer?.phone, '8184707656')
  })
  it('leaves a view with no customer alone', () => {
    assert.deepEqual(gateCustomerPhone({ customer: null }, false), { customer: null })
  })
})
