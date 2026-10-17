import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { deriveNextSteps } from './derive-next-steps'

describe('deriveNextSteps', () => {
  it('opens on telling us you are ready', () => {
    assert.deepEqual(deriveNextSteps({ requested: false, requestStatus: null, signed: false }), { states: ['done', 'current', 'upcoming', 'upcoming'], action: 'request' })
  })
  it('marks the request done once sent', () => {
    assert.deepEqual(deriveNextSteps({ requested: true, requestStatus: null, signed: false }).action, 'requested')
  })
  it('waits on the signature once the envelope is out', () => {
    assert.deepEqual(deriveNextSteps({ requested: false, requestStatus: 'inprogress', signed: false }), { states: ['done', 'done', 'current', 'upcoming'], action: 'sign' })
  })
  it('moves to kickoff once signed', () => {
    assert.deepEqual(deriveNextSteps({ requested: false, requestStatus: 'completed', signed: true }), { states: ['done', 'done', 'done', 'current'], action: 'kickoff' })
  })
  it('goes back to telling us you are ready when the envelope is declined, recalled or expired', () => {
    for (const requestStatus of ['declined', 'recalled', 'expired'] as const) {
      assert.equal(deriveNextSteps({ requested: false, requestStatus, signed: false }).action, 'request')
    }
  })
})
