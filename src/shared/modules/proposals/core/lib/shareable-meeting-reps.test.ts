import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { toShareableMeetingReps } from './shareable-meeting-reps'

describe('toShareableMeetingReps', () => {
  it('keeps exactly the four fields a share link may carry', () => {
    const rep = { name: 'Sean Phil', email: 'sean@example.com', phone: '8184707656', headshotUrl: null, userId: 'u1', role: 'owner' }
    assert.deepEqual(toShareableMeetingReps([rep as never]), [{ name: 'Sean Phil', email: 'sean@example.com', phone: '8184707656', headshotUrl: null }])
  })
})
