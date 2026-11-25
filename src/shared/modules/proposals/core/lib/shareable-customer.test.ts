import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { toShareableCustomer } from './shareable-customer'

describe('toShareableCustomer', () => {
  it('drops the internal phone-unlock flag and keeps the homeowner’s own details', () => {
    const customer = { id: 'c1', name: 'Ana Ruiz', phone: '8184707656', email: 'ana@example.com', hasSentProposal: false }
    const shared = toShareableCustomer(customer)
    assert.deepEqual(shared, { id: 'c1', name: 'Ana Ruiz', phone: '8184707656', email: 'ana@example.com' })
    assert.equal(Object.hasOwn(shared ?? {}, 'hasSentProposal'), false)
  })
  it('leaves no customer as none', () => {
    assert.equal(toShareableCustomer(null), null)
  })
})
