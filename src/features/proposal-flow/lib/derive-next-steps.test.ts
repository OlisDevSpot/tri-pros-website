import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { deriveNextSteps } from './derive-next-steps'

const base = { requested: false, requestStatus: null, contractorSigned: false, signed: false } as const

describe('deriveNextSteps', () => {
  it('opens on telling us you are ready', () => {
    assert.deepEqual(deriveNextSteps(base), { states: ['done', 'current', 'upcoming', 'upcoming'], action: 'request' })
  })
  it('marks the request done once sent', () => {
    assert.deepEqual(deriveNextSteps({ ...base, requested: true }), { states: ['done', 'done', 'upcoming', 'upcoming'], action: 'requested' })
  })
  it('treats a draft envelope as prepared', () => {
    assert.deepEqual(deriveNextSteps({ ...base, requestStatus: 'draft' }), { states: ['done', 'done', 'upcoming', 'upcoming'], action: 'prepared' })
  })
  it('holds at step 2 while the envelope awaits the contractor', () => {
    assert.deepEqual(deriveNextSteps({ ...base, requestStatus: 'inprogress' }), { states: ['done', 'current', 'upcoming', 'upcoming'], action: 'review' })
  })
  it('waits on the homeowner signature once the contractor has signed', () => {
    assert.deepEqual(deriveNextSteps({ ...base, requestStatus: 'inprogress', contractorSigned: true }), { states: ['done', 'done', 'current', 'upcoming'], action: 'sign' })
  })
  it('moves to kickoff once signed, by status or by stamp', () => {
    const kickoff = { states: ['done', 'done', 'done', 'current'], action: 'kickoff' }
    assert.deepEqual(deriveNextSteps({ ...base, requestStatus: 'completed', signed: true }), kickoff)
    assert.deepEqual(deriveNextSteps({ ...base, signed: true }), kickoff)
  })
  it('never offers a new request after a decline', () => {
    assert.equal(deriveNextSteps({ ...base, requestStatus: 'declined' }).action, 'declined')
    assert.equal(deriveNextSteps({ ...base, requestStatus: 'declined', requested: true }).action, 'declined')
  })
  it('goes back to telling us you are ready when the envelope is recalled or expired', () => {
    for (const requestStatus of ['recalled', 'expired'] as const) {
      assert.equal(deriveNextSteps({ ...base, requestStatus }).action, 'request')
    }
  })
})
