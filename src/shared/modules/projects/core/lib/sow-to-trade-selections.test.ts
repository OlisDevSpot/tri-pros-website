import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { sowToTradeSelections } from './sow-to-trade-selections'

describe('sowToTradeSelections', () => {
  it('turns each part into a selection of its trade and scopes', () => {
    const sow = [{ trade: { id: 't1', label: 'Roof & Gutters' }, scopes: [{ id: 's1', label: 'Roof replacement' }] }] as never
    assert.deepEqual(sowToTradeSelections(sow), [{ tradeId: 't1', tradeName: 'Roof & Gutters', selectedScopes: [{ id: 's1', label: 'Roof replacement' }], painPoints: [] }])
  })
  it('skips a part with no trade', () => {
    assert.deepEqual(sowToTradeSelections([{ trade: { id: '', label: '' }, scopes: [] }] as never), [])
  })
})
