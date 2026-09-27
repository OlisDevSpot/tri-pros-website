import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'
import type { SaleFact } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

import assert from 'node:assert/strict'

import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
import { isProjectMeeting, isSit, MEETING_OUTCOME_SIT, meetingOutcomes } from '@/shared/constants/enums/meetings'
import { projectPipelineStages } from '@/shared/constants/enums/pipelines'
import { groupDuplicatePeople } from '@/shared/entities/customers/lib/group-duplicate-people'
import { businessMonthKey, businessMonthWindow } from '@/shared/lib/business-time'
import { normalizeEmail } from '@/shared/lib/email'
import { projectBankability } from '@/shared/modules/projects/core/lib/bankability'
import { classifySale, SALE_STATUS } from '@/shared/modules/proposals/core/lib/sale'

function customer(id: string, createdAt: string, over: Partial<CustomerFact> = {}): CustomerFact {
  return { id, phone: null, email: null, createdAt, leadSourceId: 'src-a', city: 'Irvine', zip: '92618', ...over }
}
function meeting(id: string, customerId: string | null, scheduledFor: string, meetingOutcome: MeetingFact['meetingOutcome'], over: Partial<MeetingFact> = {}): MeetingFact {
  return { id, customerId, meetingType: 'Fresh', meetingOutcome, scheduledFor, projectId: null, closerIds: [], ...over }
}
function sale(id: string, meetingId: string | null, approvedAt: string | null, over: Partial<SaleFact> = {}): SaleFact {
  return { id, meetingId, kind: 'initial-sale', approvedAt, finalTcpCents: 1_000_000, ...over }
}
const NOW = new Date('2026-09-26T19:00:00.000Z')

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

// ── 2. Anchor ───────────────────────────────────────────────────────────────
{
  const { leads } = buildLeadRecords({
    customers: [
      customer('late', '2026-06-02T17:00:00.000Z', { phone: '5551112222', leadSourceId: 'src-b', city: 'Irvine', zip: '92618' }),
      customer('early', '2026-06-01T17:00:00.000Z', { phone: '5551112222', leadSourceId: null, city: 'Unknown', zip: '' }),
    ],
    meetings: [],
    sales: [],
  }, NOW)
  assert.equal(leads.length, 1, 'duplicates are one lead')
  const [person] = leads
  assert.equal(person.personId, 'early', 'the earliest record names the person')
  assert.deepEqual(person.customerIds.sort(), ['early', 'late'], 'both records belong to the person')
  assert.equal(person.leadAt, '2026-06-01T17:00:00.000Z', 'lead date is the earliest record\'s')
  assert.equal(person.leadSourceId, null, 'the earliest record\'s source wins, even when unknown')
  assert.equal(person.city, null, '\'Unknown\' city is unknown')
  assert.equal(person.zip, null, 'empty zip is unknown')
}
console.log('2. Anchor ✓')

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

// ── 5. Booked lead ──────────────────────────────────────────────────────────
{
  const { leads, orphans } = buildLeadRecords({
    customers: [
      customer('p1', '2026-06-01T17:00:00.000Z', { phone: '5550000001' }),
      customer('p1-dup', '2026-06-02T17:00:00.000Z', { phone: '5550000001' }),
      customer('p2', '2026-06-01T17:00:00.000Z'),
      customer('p3', '2026-06-01T17:00:00.000Z'),
      customer('p4', '2026-06-01T17:00:00.000Z'),
    ],
    meetings: [
      meeting('m1', 'p1-dup', '2026-06-05T17:00:00.000Z', 'cancelled'),
      meeting('m2', 'p1-dup', '2026-06-12T17:00:00.000Z', 'cancelled'),
      meeting('m3', 'p1-dup', '2026-07-03T17:00:00.000Z', 'pns'),
      meeting('m4', 'p2', '2026-06-05T17:00:00.000Z', 'cancelled'),
      meeting('m5', 'p3', '2026-06-05T17:00:00.000Z', 'not_set', { meetingType: 'Project' }),
      meeting('m6', 'p3', '2026-06-06T17:00:00.000Z', 'additional_work', { meetingType: 'Project' }),
      meeting('m7', 'p4', '2026-07-01T17:00:00.000Z', 'not_set'),
      meeting('m8', 'p4', '2026-10-01T17:00:00.000Z', 'not_set'),
      meeting('m9', null, '2026-06-05T17:00:00.000Z', 'pns'),
    ],
    sales: [sale('s1', 'm3', '2026-07-20T17:00:00.000Z'), sale('s2', 'm9', '2026-07-20T17:00:00.000Z'), sale('s3', null, '2026-07-20T17:00:00.000Z')],
  }, NOW)
  const byId = new Map(leads.map(p => [p.personId, p]))
  assert.deepEqual(byId.get('p1')!.bookedLead, { at: '2026-07-03T17:00:00.000Z', meetingId: 'm3', sat: true }, 'cancel, cancel, sit = 1 booked lead dated at the sit — meetings on the duplicate record count')
  assert.equal(byId.get('p1')!.sales.length, 1, 'a sale on the duplicate record rolls up to the person')
  assert.deepEqual(byId.get('p2')!.bookedLead, { at: '2026-06-05T17:00:00.000Z', meetingId: 'm4', sat: false }, 'a single cancelled meeting = 1 non-sit booked lead')
  assert.equal(byId.get('p3')!.bookedLead, null, 'project meetings, upsells included, never book a lead')
  assert.deepEqual(byId.get('p4')!.meetings.map(m => m.unresolved), [true, false], 'a past not_set is unresolved; a future one is not')
  assert.deepEqual(byId.get('p1')!.meetings.map(m => m.unresolved), [false, false, false], 'a past meeting with an outcome is never unresolved')
  assert.equal(orphans, 3, 'a meeting with no customer, a sale on it, and a sale with no meeting are orphans')
}
console.log('5. Booked lead ✓')

// ── 6. Meeting order ────────────────────────────────────────────────────────
{
  const { leads } = buildLeadRecords({
    customers: [customer('a', '2026-06-01T17:00:00.000Z'), customer('b', '2026-06-01T17:00:00.000Z'), customer('c', '2026-06-01T17:00:00.000Z'), customer('d', '2026-06-01T17:00:00.000Z')],
    meetings: [
      meeting('a2', 'a', '2026-06-10T17:00:00.000Z', 'pns'),
      meeting('a1', 'a', '2026-06-03T17:00:00.000Z', 'cancelled'),
      meeting('b1', 'b', '2026-06-03T17:00:00.000Z', 'pns'),
      meeting('b2', 'b', '2026-06-10T17:00:00.000Z', 'follow_up_needed'),
      meeting('b3', 'b', '2026-06-17T17:00:00.000Z', 'cancelled'),
      meeting('b4', 'b', '2026-06-20T17:00:00.000Z', 'not_set', { meetingType: 'Project' }),
      meeting('c1', 'c', '2026-06-03T17:00:00.000Z', 'no_show'),
      meeting('c2', 'c', '2026-06-10T17:00:00.000Z', 'cancelled'),
      meeting('d-y', 'd', '2026-06-03T17:00:00.000Z', 'pns'),
      meeting('d-x', 'd', '2026-06-03T17:00:00.000Z', 'npns'),
    ],
    sales: [],
  }, NOW)
  const orders = (id: string) => leads.find(p => p.personId === id)!.meetings.map(m => `${m.id}:${m.order}`)
  assert.deepEqual(orders('a'), ['a1:not_sat', 'a2:first'], 'cancelled then pns: the pns is first')
  assert.deepEqual(orders('b'), ['b1:first', 'b2:repeat', 'b3:repeat', 'b4:project'], 'after the first sit every non-project meeting is repeat')
  assert.deepEqual(orders('c'), ['c1:not_sat', 'c2:not_sat'], 'a person who never sat has only not_sat meetings')
  assert.deepEqual(orders('d'), ['d-x:first', 'd-y:repeat'], 'same instant: ties break by id, deterministically')
}
console.log('6. Meeting order ✓')

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
