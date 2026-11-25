import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { scopesTriggerLabel } from './scopes-trigger-label'

describe('scopesTriggerLabel', () => {
  it('no scopes leaves the placeholder to speak', () => {
    assert.equal(scopesTriggerLabel([]), undefined)
  })
  it('one scope', () => {
    assert.equal(scopesTriggerLabel(['Tear-off']), 'Scopes: Tear-off')
  })
  it('two scopes', () => {
    assert.equal(scopesTriggerLabel(['Tear-off', 'Underlayment']), 'Scopes: Tear-off and Underlayment')
  })
  it('three scopes count the rest', () => {
    assert.equal(scopesTriggerLabel(['Tear-off', 'Underlayment', 'Flashing']), 'Scopes: Tear-off, Underlayment and 1 more scope')
  })
  it('many scopes count the rest', () => {
    assert.equal(
      scopesTriggerLabel(['Tear-off', 'Underlayment', 'Flashing', 'Vents', 'Gutters']),
      'Scopes: Tear-off, Underlayment and 3 more scopes',
    )
  })
})
