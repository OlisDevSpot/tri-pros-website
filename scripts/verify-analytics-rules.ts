import assert from 'node:assert/strict'

import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { isProjectMeeting, isSit, MEETING_OUTCOME_SIT, meetingOutcomes } from '@/shared/constants/enums/meetings'
import { businessMonthKey, businessMonthWindow } from '@/shared/lib/business-time'

// ── 3. Sit map ──────────────────────────────────────────────────────────────
for (const outcome of meetingOutcomes) {
  assert.ok(['sat', 'not_sat', 'unknown'].includes(MEETING_OUTCOME_SIT[outcome]), `${outcome} is classified`)
}
assert.deepEqual(
  meetingOutcomes.filter(isSit).sort(),
  ['additional_work', 'converted_to_project', 'follow_up_needed', 'ftd', 'lost_to_competitor', 'not_good', 'npns', 'pns', 'proposal_created', 'proposal_sent'],
  'sat outcomes',
)
assert.deepEqual(
  meetingOutcomes.filter(o => MEETING_OUTCOME_SIT[o] === 'not_sat').sort(),
  ['cancelled', 'no_show', 'nra', 'reschedule_needed'],
  'not-sat outcomes',
)
assert.equal(MEETING_OUTCOME_SIT.not_set, 'unknown', 'not_set is unknown, never a sit')
console.log('3. Sit map ✓')

// ── 4. Project meeting ──────────────────────────────────────────────────────
assert.equal(isProjectMeeting({ meetingType: 'Project' }), true, 'the Project type is a project meeting')
for (const meetingType of ['Fresh', 'Follow-up', 'Rehash'] as const) {
  assert.equal(isProjectMeeting({ meetingType }), false, `${meetingType} works a lead`)
}
console.log('4. Project meeting ✓')

// ── 7. Pacific months ───────────────────────────────────────────────────────
assert.equal(businessMonthKey('2026-08-01T05:30:00.000Z'), '2026-07', 'July 31 22:30 PDT is July')
assert.equal(businessMonthKey(new Date('2026-08-01T07:00:00.000Z')), '2026-08', 'Aug 1 00:00 PDT is August')
assert.deepEqual(businessMonthWindow('2026-03'), { from: '2026-03-01T08:00:00.000Z', to: '2026-04-01T07:00:00.000Z' }, 'March spans the spring-forward switch')
assert.deepEqual(businessMonthWindow('2026-11'), { from: '2026-11-01T07:00:00.000Z', to: '2026-12-01T08:00:00.000Z' }, 'November spans the fall-back switch')
assert.deepEqual(businessMonthWindow('2026-12'), { from: '2026-12-01T08:00:00.000Z', to: '2027-01-01T08:00:00.000Z' }, 'December rolls the year')
assert.deepEqual(meetingMonthWindow('2026-03-15'), businessMonthWindow('2026-03'), 'dashboard month window is the business month window')
console.log('7. Pacific months ✓')

console.log('✅ verify-analytics-rules passed')
