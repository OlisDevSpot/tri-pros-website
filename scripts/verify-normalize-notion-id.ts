/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { normalizeNotionId } from '@/shared/services/providers/notion/lib/normalize-notion-id'

const DASHED = '6240ca1b-548b-837d-a9c0-01acc1fb530a'
const UNDASHED = '6240ca1b548b837da9c001acc1fb530a'

assert.equal(normalizeNotionId(UNDASHED), DASHED, 'undashed 32-hex gains dashes')
assert.equal(normalizeNotionId(DASHED), DASHED, 'already dashed is idempotent')
assert.equal(normalizeNotionId(DASHED.toUpperCase()), DASHED, 'uppercase is lowercased')
assert.equal(normalizeNotionId(UNDASHED.toUpperCase()), DASHED, 'uppercase undashed')
assert.equal(normalizeNotionId(`  ${DASHED}  `), DASHED, 'surrounding whitespace trimmed on UUID')

// Not a Notion id — returned unchanged, never mangled.
assert.equal(normalizeNotionId(''), '', 'empty string passes through')
assert.equal(normalizeNotionId('kitchen-remodel'), 'kitchen-remodel', 'a slug passes through')
assert.equal(normalizeNotionId('Kitchen Remodel'), 'Kitchen Remodel', 'a display name passes through unchanged, case intact')
assert.equal(normalizeNotionId('6240ca1b'), '6240ca1b', 'too short passes through')
assert.equal(normalizeNotionId('z'.repeat(32)), 'z'.repeat(32), 'non-hex 32 chars passes through')
assert.equal(normalizeNotionId('  kitchen-remodel  '), 'kitchen-remodel', 'a non-id is trimmed but otherwise untouched')

console.log('✅ normalizeNotionId verified')
