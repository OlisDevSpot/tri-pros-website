import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { canSendProposal } from './can-send-proposal'

const open = { contractEnvelopeId: null, contractSentAt: null, contractSignedAt: null, contractDeclinedAt: null }

describe('canSendProposal', () => {
  it('allows draft and sent proposals with no envelope', () => {
    assert.equal(canSendProposal({ ...open, status: 'draft' }), true)
    assert.equal(canSendProposal({ ...open, status: 'sent' }), true)
  })
  it('refuses approved and declined proposals', () => {
    assert.equal(canSendProposal({ ...open, status: 'approved' }), false)
    assert.equal(canSendProposal({ ...open, status: 'declined' }), false)
  })
  it('refuses a proposal with an envelope', () => {
    assert.equal(canSendProposal({ ...open, status: 'sent', contractEnvelopeId: 'env_1' }), false)
  })
})
