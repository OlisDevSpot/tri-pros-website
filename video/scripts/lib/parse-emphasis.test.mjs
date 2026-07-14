import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseScriptEmphasis } from './parse-emphasis.mjs'

test('single emphasized word', () => {
  const r = parseScriptEmphasis('built with *AAA-grade* materials')
  assert.deepEqual(r.words, ['built', 'with', 'AAA-grade', 'materials'])
  assert.deepEqual(r.emphasis, [false, false, true, false])
  assert.equal(r.plainScript, 'built with AAA-grade materials')
})

test('multi-word emphasized phrase', () => {
  const r = parseScriptEmphasis('that *spa feeling*, every day')
  assert.deepEqual(r.words, ['that', 'spa', 'feeling,', 'every', 'day'])
  assert.deepEqual(r.emphasis, [false, true, true, false, false])
})

test('no markers = no emphasis', () => {
  const r = parseScriptEmphasis('homeowners only')
  assert.deepEqual(r.emphasis, [false, false])
})

test('standalone punctuation tokens stay separate words (em-dash pause)', () => {
  const r = parseScriptEmphasis('Homeowners only — see if your home qualifies.')
  assert.deepEqual(r.words, ['Homeowners', 'only', '—', 'see', 'if', 'your', 'home', 'qualifies.'])
  assert.deepEqual(r.emphasis, [false, false, false, false, false, false, false, false])
})
