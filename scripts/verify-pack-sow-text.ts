/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { SOW_FIELD_MAX_CHARS } from '@/shared/services/zoho-sign/constants'
import { packSowText } from '@/shared/services/zoho-sign/lib/pack-sow-text'

// Case 1: input under the cap fits entirely in sow1
{
  const text = 'Short scope of work.'
  const { sow1, sow2, overflow } = packSowText(text)
  assert.equal(sow1, text)
  assert.equal(sow2, '')
  assert.equal(overflow, 0)
}

// Case 2: exactly 2000 chars, single paragraph, no split needed
{
  const text = 'a'.repeat(SOW_FIELD_MAX_CHARS)
  const { sow1, sow2, overflow } = packSowText(text)
  assert.equal(sow1.length, SOW_FIELD_MAX_CHARS)
  assert.equal(sow2, '')
  assert.equal(overflow, 0)
}

// Case 3: two paragraphs joined by \n\n, each ~1500 chars — cleanly splits on \n\n
{
  const p1 = 'First paragraph. '.repeat(90) // ~1530 chars
  const p2 = 'Second paragraph. '.repeat(90) // ~1620 chars
  const text = `${p1}\n\n${p2}`
  const { sow1, sow2, overflow } = packSowText(text)
  assert.ok(sow1.length <= SOW_FIELD_MAX_CHARS, `sow1 within cap: ${sow1.length}`)
  assert.ok(sow2.length <= SOW_FIELD_MAX_CHARS, `sow2 within cap: ${sow2.length}`)
  assert.equal(overflow, 0, 'no overflow expected')
  assert.ok(!sow1.includes('Second paragraph'), 'sow1 stops at paragraph boundary')
  assert.ok(sow2.startsWith('Second paragraph'), 'sow2 starts with p2')
}

// Case 4: long single paragraph with sentence breaks → splits at '. '
{
  const sentence = 'This is a sentence that is moderately long and has multiple words in it. '
  const text = sentence.repeat(50) // ~3700 chars
  const { sow1, sow2, overflow } = packSowText(text)
  assert.ok(sow1.length <= SOW_FIELD_MAX_CHARS)
  assert.ok(sow2.length <= SOW_FIELD_MAX_CHARS)
  assert.ok(overflow >= 0)
}

// Case 5: pathological 3500-char single word → hard-break at cap
{
  const text = 'a'.repeat(3500)
  const { sow1, sow2 } = packSowText(text)
  assert.equal(sow1.length, SOW_FIELD_MAX_CHARS, 'hard-break at cap when no boundary found')
  assert.equal(sow2.length, 3500 - SOW_FIELD_MAX_CHARS)
}

// Case 6: trailing whitespace is trimmed
{
  const text = `Scope content.${'\n'.repeat(10)}`
  const { sow1 } = packSowText(text)
  assert.equal(sow1, 'Scope content.')
}

console.log('✅ packSowText verified')
