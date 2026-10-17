import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { firstName, joinFirstNames, repsPhrase, repsVerb } from './rep-names'

const one = [{ name: 'Sean Phil' }]
const two = [{ name: 'Sean Phil' }, { name: 'Bar Abudi' }]

describe('rep names', () => {
  it('takes the first word of a name', () => {
    assert.equal(firstName('Sean Phil'), 'Sean')
    assert.equal(firstName('  Bar   Abudi '), 'Bar')
    assert.equal(firstName('Cher'), 'Cher')
    assert.equal(firstName('   '), '')
  })
  it('joins first names with and', () => {
    assert.equal(joinFirstNames(two), 'Sean and Bar')
    assert.equal(joinFirstNames(one), 'Sean')
    assert.equal(joinFirstNames([]), '')
  })
  it('falls back to the team when there are no reps', () => {
    assert.equal(repsPhrase([]), 'our team')
    assert.equal(repsPhrase([{ name: '  ' }]), 'our team')
    assert.equal(repsPhrase(two), 'Sean and Bar')
  })
  it('capitalizes the team, never a name, at the start of a sentence', () => {
    assert.equal(repsPhrase([], { sentenceStart: true }), 'Our team')
    assert.equal(repsPhrase(one, { sentenceStart: true }), 'Sean')
  })
  it('agrees the verb with the reps', () => {
    assert.equal(repsVerb(one, 'prepares', 'prepare'), 'prepares')
    assert.equal(repsVerb(two, 'prepares', 'prepare'), 'prepare')
    assert.equal(repsVerb([], 'prepares', 'prepare'), 'prepares')
  })
})
