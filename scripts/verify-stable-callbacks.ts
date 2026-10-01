/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { hasSameValues, withLatestCallbacks } from '@/shared/lib/stable-callbacks'

const first = () => 1
const second = () => 2
const selected = new Set(['x'])

assert.equal(hasSameValues({ onClick: first, can: true }, { onClick: second, can: true }), true, 'a new closure alone is no change')
assert.equal(hasSameValues({ onClick: first, can: true }, { onClick: first, can: false }), false, 'a value change is a change')
assert.equal(hasSameValues({ ids: selected }, { ids: new Set(['x']) }), false, 'values compare by identity')
assert.equal(hasSameValues({ ids: selected }, { ids: selected }), true, 'the same value is no change')
assert.equal(hasSameValues({ onClick: first }, { onClick: first, extra: 1 }), false, 'an added entry is a change')
assert.equal(hasSameValues({ x: 1, onClick: first }, { y: 1, onClick: first }), false, 'a renamed entry is a change')
assert.equal(hasSameValues({ onClick: first }, { onClick: undefined }), false, 'a callback removed is a change')
assert.equal(hasSameValues([{ onAction: first, isLoading: false }], [{ onAction: second, isLoading: false }]), true, 'array items compare entry by entry')
assert.equal(hasSameValues([{ onAction: first, isLoading: false }], [{ onAction: first, isLoading: true }]), false, 'a flag flip in an item is a change')
assert.equal(hasSameValues([{ onAction: first }], [{ onAction: first }, { onAction: first }]), false, 'an added item is a change')

let current = { onClick: (n: number) => n + 1, label: 'x' }
const stable = withLatestCallbacks(current, () => current)
current = { onClick: (n: number) => n + 100, label: 'x' }
assert.equal(stable.onClick(1), 101, 'the wrapper calls the latest closure')
assert.equal(stable.label, 'x', 'values pass through')

let items = [{ onAction: () => 'first', isLoading: false }]
const stableItems = withLatestCallbacks(items, () => items)
items = [{ onAction: () => 'second', isLoading: false }]
assert.equal(stableItems[0]?.onAction(), 'second', 'array items call the latest closure')

let shrinking: { onClick?: () => string } = { onClick: () => 'kept' }
const fallback = withLatestCallbacks(shrinking, () => shrinking)
shrinking = {}
assert.equal(fallback.onClick?.(), 'kept', 'a callback gone from the latest value falls back to its own closure')

console.log('✅ stable callbacks verified')
