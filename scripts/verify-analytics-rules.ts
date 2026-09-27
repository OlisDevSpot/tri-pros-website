import assert from 'node:assert/strict'

import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { isProjectMeeting, isSit, MEETING_OUTCOME_SIT, meetingOutcomes } from '@/shared/constants/enums/meetings'
import { projectPipelineStages } from '@/shared/constants/enums/pipelines'
import { groupDuplicatePeople } from '@/shared/entities/customers/lib/group-duplicate-people'
import { businessMonthKey, businessMonthWindow } from '@/shared/lib/business-time'
import { normalizeEmail } from '@/shared/lib/email'
import { projectBankability } from '@/shared/modules/projects/core/lib/bankability'
import { classifySale, SALE_STATUS } from '@/shared/modules/proposals/core/lib/sale'

// ── 1. Grouping ─────────────────────────────────────────────────────────────
assert.equal(normalizeEmail('  Bob@X.com '), 'bob@x.com', 'email trimmed and lower-cased')
assert.equal(normalizeEmail('   '), null, 'blank email is no email')
{
  const people = groupDuplicatePeople([
    { id: 'b', phone: '(555) 123-4567', email: 'Bob@X.com ', createdAt: '2026-06-02T17:00:00.000Z' },
    { id: 'a', phone: '5551234567', email: null, createdAt: '2026-06-01T17:00:00.000Z' },
    { id: 'c', phone: null, email: 'bob@x.com', createdAt: '2026-06-03T17:00:00.000Z' },
    { id: 'd', phone: '15559876543', email: null, createdAt: '2026-06-04T17:00:00.000Z' },
    { id: 'e', phone: '5559876543', email: null, createdAt: '2026-06-04T17:00:00.000Z' },
    { id: 'f', phone: null, email: null, createdAt: '2026-06-05T17:00:00.000Z' },
    { id: 'g', phone: '', email: '  ', createdAt: '2026-06-06T17:00:00.000Z' },
  ])
  assert.equal(people.get('a'), 'a', 'a~b by phone, b~c by email: the earliest record names the person')
  assert.equal(people.get('b'), 'a', 'formatted phone matches its 10-digit form')
  assert.equal(people.get('c'), 'a', 'matches chain through email case/whitespace variants')
  assert.equal(people.get('d'), 'd', '1-prefixed phone matches; same createdAt ties break by id')
  assert.equal(people.get('e'), 'd', 'household phone is one person')
  assert.equal(people.get('f'), 'f', 'no phone, no email: alone')
  assert.equal(people.get('g'), 'g', 'empty phone and blank email never match each other')
}
console.log('1. Grouping ✓')

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

// ── 8. Sales (classification) ───────────────────────────────────────────────
assert.equal(SALE_STATUS, 'approved', 'a sale is an approved proposal')
assert.deepEqual(
  classifySale({ kind: 'initial-sale', approvedAt: '2026-07-20T17:00:00.000Z', finalTcpCents: 1_000_000 }),
  { kind: 'new', at: '2026-07-20T17:00:00.000Z', valueCents: 1_000_000 },
  'initial sale is a new sale dated at approval',
)
assert.deepEqual(
  classifySale({ kind: 'additional-work', approvedAt: null, finalTcpCents: null }),
  { kind: 'upsell', at: null, valueCents: null },
  'additional work is an upsell; no fallback date, no fallback value',
)
console.log('8. Sales (classification) ✓')

// ── 10. Bankability ─────────────────────────────────────────────────────────
for (const stage of projectPipelineStages) {
  assert.ok(['net', 'at_risk', 'cancelled'].includes(projectBankability(stage)), `${stage} maps`)
}
assert.equal(projectBankability('on_hold'), 'at_risk', 'on hold is still potential money')
assert.equal(projectBankability('cancelled'), 'cancelled', 'cancelled leaves net')
assert.equal(projectBankability('signed'), 'net', 'a live project is net')
console.log('10. Bankability ✓')

console.log('✅ verify-analytics-rules passed')
