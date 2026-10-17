import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { SYSTEM_OWNER_EMAIL } from '@/shared/constants/system-users'
import { toMeetingReps } from './to-meeting-reps'

function row(role: 'owner' | 'co_owner', name: string, email = `${name.toLowerCase()}@example.com`) {
  return { role, userName: name, userEmail: email, userPhone: null, userHeadshotUrl: null }
}

describe('toMeetingReps', () => {
  it('drops a meeting owned only by the system user', () => {
    assert.deepEqual(toMeetingReps([row('owner', 'Tri Pros', SYSTEM_OWNER_EMAIL)]), [])
  })
  it('puts the owner first when the co-owner was added before', () => {
    assert.deepEqual(toMeetingReps([row('co_owner', 'Dana'), row('owner', 'Alex')]).map(rep => rep.name), ['Alex', 'Dana'])
  })
  it('keeps a single rep with their contact details', () => {
    assert.deepEqual(toMeetingReps([{ ...row('owner', 'Alex'), userPhone: '+15550100', userHeadshotUrl: 'https://cdn.example.com/a.webp' }]), [
      { name: 'Alex', email: 'alex@example.com', phone: '+15550100', headshotUrl: 'https://cdn.example.com/a.webp' },
    ])
  })
  it('keeps two reps, owner then co-owner', () => {
    assert.deepEqual(toMeetingReps([row('owner', 'Alex'), row('co_owner', 'Dana')]).map(rep => rep.name), ['Alex', 'Dana'])
  })
  it('keeps the co-owner when the system user owns the meeting', () => {
    assert.deepEqual(toMeetingReps([row('owner', 'Tri Pros', SYSTEM_OWNER_EMAIL), row('co_owner', 'Dana')]).map(rep => rep.name), ['Dana'])
  })
})
