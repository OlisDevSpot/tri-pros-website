import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { getVisibleActions } from './visible-actions'

const ability = { can: (action: string) => action === 'read' } as never
const item = (id: string, permission: [string, string]) => ({ action: { id, label: id, icon: () => null, permission }, onAction: () => {} })

describe('getVisibleActions with a group', () => {
  it('keeps only the items the viewer may run', () => {
    const group = { action: { id: 'g', label: 'g', icon: () => null }, type: 'group' as const, items: [item('a', ['read', 'Proposal']), item('b', ['delete', 'Proposal'])] }
    const [kept] = getVisibleActions([group as never], ability, {})
    assert.deepEqual((kept as unknown as typeof group).items.map(i => i.action.id), ['a'])
  })
  it('drops a group with no item left', () => {
    const group = { action: { id: 'g', label: 'g', icon: () => null }, type: 'group' as const, items: [item('b', ['delete', 'Proposal'])] }
    assert.deepEqual(getVisibleActions([group as never], ability, {}), [])
  })
})
