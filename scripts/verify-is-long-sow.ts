/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { SOW_INLINE_MAX_CHARS } from '@/shared/services/zoho-sign/constants'
import { isLongSow } from '@/shared/services/zoho-sign/lib/is-long-sow'

assert.equal(SOW_INLINE_MAX_CHARS, 3600, 'threshold constant drifted')

assert.equal(isLongSow(''), false, 'empty text')
assert.equal(isLongSow('a'.repeat(3599)), false, 'below threshold')
assert.equal(isLongSow('a'.repeat(3600)), false, 'exactly at threshold')
assert.equal(isLongSow('a'.repeat(3601)), true, 'just over threshold')
assert.equal(isLongSow('a'.repeat(10000)), true, 'well over')

console.log('✅ isLongSow verified')
