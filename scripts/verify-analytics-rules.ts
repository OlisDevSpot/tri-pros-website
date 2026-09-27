import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'
import type { SaleFact } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

import assert from 'node:assert/strict'

import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { aggregateLeadRecords } from '@/features/analytics/lib/aggregate-lead-records'
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
    customers: [customer('a', '2026-06-01T17:00:00.000Z'), customer('b', '2026-06-01T17:00:00.000Z'), customer('c', '2026-06-01T17:00:00.000Z'), customer('d', '2026-06-01T17:00:00.000Z'), customer('e', '2026-06-01T17:00:00.000Z')],
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
      meeting('e1', 'e', '2026-06-03T17:00:00.000Z', 'additional_work', { meetingType: 'Project' }),
      meeting('e2', 'e', '2026-06-10T17:00:00.000Z', 'cancelled'),
      meeting('e3', 'e', '2026-06-17T17:00:00.000Z', 'pns'),
    ],
    sales: [],
  }, NOW)
  const orders = (id: string) => leads.find(p => p.personId === id)!.meetings.map(m => `${m.id}:${m.order}`)
  assert.deepEqual(orders('a'), ['a1:not_sat', 'a2:first'], 'cancelled then pns: the pns is first')
  assert.deepEqual(orders('b'), ['b1:first', 'b2:repeat', 'b3:repeat', 'b4:project'], 'after the first sit every non-project meeting is repeat')
  assert.deepEqual(orders('c'), ['c1:not_sat', 'c2:not_sat'], 'a person who never sat has only not_sat meetings')
  assert.deepEqual(orders('d'), ['d-x:first', 'd-y:repeat'], 'same instant: ties break by id, deterministically')
  assert.deepEqual(orders('e'), ['e1:project', 'e2:not_sat', 'e3:first'], 'a sat project meeting never counts as the first sit')
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

// ── 9. Aggregation ──────────────────────────────────────────────────────────
{
  const records = buildLeadRecords({
    customers: [
      customer('c1', '2026-07-01T17:00:00.000Z', { leadSourceId: 'src-a' }),
      customer('c2', '2026-07-02T17:00:00.000Z', { leadSourceId: 'src-b' }),
      customer('c3', '2026-07-03T17:00:00.000Z', { leadSourceId: 'src-a', city: 'Unknown' }),
    ],
    meetings: [
      meeting('m1', 'c1', '2026-07-10T17:00:00.000Z', 'converted_to_project', { closerIds: ['u1', 'u2'], projectId: 'p1' }),
      meeting('m2', 'c2', '2026-07-11T17:00:00.000Z', 'cancelled', { closerIds: ['u1'] }),
      meeting('m3', 'c3', '2026-08-01T06:30:00.000Z', 'not_good', { closerIds: ['u2'] }),
      meeting('m4', 'c1', '2026-07-25T17:00:00.000Z', 'additional_work', { meetingType: 'Project', closerIds: ['u1'], projectId: 'p1' }),
    ],
    sales: [
      sale('s1', 'm1', '2026-07-20T17:00:00.000Z', { finalTcpCents: 1_000_000 }),
      sale('s2', 'm3', null, { finalTcpCents: null }),
      sale('s3', 'm4', '2026-07-26T17:00:00.000Z', { kind: 'additional-work', finalTcpCents: 200_000 }),
    ],
  }, NOW)
  const july = businessMonthWindow('2026-07')

  const [total] = aggregateLeadRecords(records, { range: july }, 'total').rows
  assert.equal(total.totalLeads, 3, 'three leads in July')
  assert.equal(total.bookedLeads, 3, 'three booked leads')
  assert.equal(total.sits, 2, 'm1 and m3 sat — m3 at 23:30 PDT on July 31 is July')
  assert.equal(total.meetings, 4, 'meetings count every row, project or not')
  assert.equal(total.newSales, 1, 'one dated new sale')
  assert.equal(total.totalCloses, 2, 'new sale + upsell')
  assert.equal(total.revenueNewCents, 1_000_000, 'new revenue')
  assert.equal(total.revenueUpsellCents, 200_000, 'upsell revenue')
  assert.equal(total.averageTicketCents, 1_000_000, 'average ticket over new sales with a value')
  assert.equal(total.rates.sitRate, 2 / 3, 'sit rate = sits / booked leads')
  assert.equal(total.rates.closeRate, 1 / 2, 'close rate = new sales / sits')
  assert.equal(total.hygiene.unknownCityZip, 1, 'c3 has an unknown city')
  assert.equal(total.hygiene.newSalesWithoutProject, 0, 'the new sale\'s meeting has a project')
  assert.equal(aggregateLeadRecords(records, { range: july }, 'total').undatedSales, 1, 'the undated sale is reported, not placed in July')

  const allTime = aggregateLeadRecords(records, {}, 'total').rows[0]
  assert.equal(allTime.newSales, 2, 'all-time totals include the undated sale')
  assert.equal(allTime.hygiene.salesWithoutValue, 1, 'a sale with no value counts as a sale, not revenue')
  assert.equal(allTime.revenueNewCents, 1_000_000, 'no value adds no revenue')
  assert.equal(allTime.hygiene.newSalesWithoutProject, 1, 'the undated new sale on m3 has no project')
  assert.deepEqual(aggregateLeadRecords(records, { range: july }, 'city').rows.map(r => [r.groupKey, r.totalLeads]), [['Irvine', 2], [null, 1]], 'grouping by city puts unknown last')
  assert.deepEqual(aggregateLeadRecords(records, { range: july }, 'total').notApplicable, [], 'nothing is not-applicable without event dimensions')
  assert.deepEqual(aggregateLeadRecords(records, { range: july }, 'closer').notApplicable, ['leads'], 'grouping by closer: leads not applicable')
  assert.deepEqual(aggregateLeadRecords(records, { range: july, outcomes: ['cancelled'] }, 'total').notApplicable, ['leads', 'sales'], 'an outcome filter: leads and sales not applicable')
  const undatedBucket = aggregateLeadRecords(records, {}, 'month').rows.find(r => r.groupKey === null)!
  assert.equal(undatedBucket.newSales, 1, 'undated sales land in the null month bucket')

  const bySource = aggregateLeadRecords(records, { range: july }, 'leadSource').rows
  const srcA = bySource.find(r => r.groupKey === 'src-a')!
  const srcB = bySource.find(r => r.groupKey === 'src-b')!
  assert.equal(srcA.rates.sitRate, 1, 'src-a sit rate')
  assert.equal(srcB.rates.sitRate, 0, 'src-b sit rate')
  assert.equal(srcB.rates.closeRate, null, 'zero sits: close rate is null, not NaN')
  assert.notEqual(total.rates.sitRate, (srcA.rates.sitRate! + srcB.rates.sitRate!) / 2, 'the total rate is Σ÷Σ, not an average of group rates')

  const byCloser = aggregateLeadRecords(records, { range: july }, 'closer').rows
  const u1 = byCloser.find(r => r.groupKey === 'u1')!
  const u2 = byCloser.find(r => r.groupKey === 'u2')!
  assert.equal(u1.totalLeads, null, 'leads are not applicable per closer')
  assert.equal(u1.bookedLeads + u2.bookedLeads, 4, 'per-closer booked leads (2 + 2) exceed the total (3)')
  assert.equal(u1.totalCloses, 2, 'u1 closed the new sale and the upsell')
  assert.ok(byCloser.every(r => r.overlapsTotal), 'per-closer rows are flagged as overlapping')

  const cancelled = aggregateLeadRecords(records, { range: july, outcomes: ['cancelled'] }, 'total').rows[0]
  assert.equal(cancelled.totalLeads, null, 'event-level filter: leads not applicable')
  assert.equal(cancelled.bookedLeads, 1, 'an outcome filter tests the booked lead\'s own meeting')
  assert.equal(cancelled.sits, 0, 'the cancelled booked lead did not sit')
  assert.equal(cancelled.newSales, null, 'an outcome filter makes sales not applicable')

  const projectOnly = aggregateLeadRecords(records, { range: july, meetingOrder: ['project'] }, 'total').rows[0]
  assert.equal(projectOnly.meetings, 1, 'meeting order narrows the meeting count')
  assert.equal(projectOnly.bookedLeads, 0, 'no booked lead is a project meeting')

  const byMonth = aggregateLeadRecords(records, {}, 'month').rows
  assert.ok(byMonth.every(r => r.sits <= r.bookedLeads), 'sits ≤ booked leads in every month')

  const nobody = aggregateLeadRecords(records, { range: july, leadSourceIds: ['src-none'] }, 'total')
  assert.equal(nobody.rows.length, 1, 'total always has one row')
  assert.equal(nobody.rows[0].totalLeads, 0, 'zero leads')
  assert.deepEqual(nobody.rows[0].rates, { bookingRate: null, sitRate: null, closeRate: null }, 'rates are null on a zero base')
  const empty = aggregateLeadRecords(buildLeadRecords({ customers: [], meetings: [], sales: [] }, NOW), {}, 'total')
  assert.equal(empty.rows[0].bookedLeads, 0, 'no data: one all-zero total row')

  assert.equal(allTime.averageTicketCents, 1_000_000, 'average ticket divides by new sales that have a value, not all new sales')

  assert.equal(projectOnly.totalLeads, null, 'a meeting-order filter: leads not applicable')
  assert.equal(projectOnly.newSales, null, 'a meeting-order filter makes sales not applicable')
  const byOutcome = aggregateLeadRecords(records, { range: july }, 'outcome').rows
  assert.ok(byOutcome.every(r => r.totalLeads === null && r.newSales === null), 'grouping by outcome: leads and sales not applicable')
  const byOrder = aggregateLeadRecords(records, { range: july }, 'meetingOrder').rows
  assert.ok(byOrder.every(r => r.totalLeads === null && r.newSales === null), 'grouping by meeting order: leads and sales not applicable')
  const firstRow = byOrder.find(r => r.groupKey === 'first')!
  assert.equal(firstRow.bookedLeads, 2, 'booked leads group by their own meeting\'s order (m1, m3)')
  assert.equal(firstRow.sits, 2, 'both first meetings sat')

  const u2Only = aggregateLeadRecords(records, { range: july, closerIds: ['u2'] }, 'total')
  assert.equal(u2Only.rows[0].totalLeads, null, 'a closer filter: leads not applicable')
  assert.equal(u2Only.rows[0].bookedLeads, 2, 'closer filter tests the booked lead\'s own meeting (m1, m3)')
  assert.equal(u2Only.rows[0].meetings, 2, 'u2 sat in m1 and m3 only')
  assert.equal(u2Only.rows[0].newSales, 1, 'a closer filter keeps sales applicable (s1 on m1)')
  assert.equal(u2Only.rows[0].totalCloses, 1, 'the upsell on m4 had no u2')
  assert.equal(u2Only.undatedSales, 1, 'the undated sale is on m3, where u2 is a closer')
  const u1Only = aggregateLeadRecords(records, { range: july, closerIds: ['u1'] }, 'total')
  assert.equal(u1Only.rows[0].totalCloses, 2, 'u1 closed s1 and the upsell')
  assert.equal(u1Only.undatedSales, 0, 'u1 was not on the undated sale\'s meeting')

  const srcBOnly = aggregateLeadRecords(records, { range: july, leadSourceIds: ['src-b'] }, 'total').rows[0]
  assert.equal(srcBOnly.totalLeads, 1, 'a source filter keeps only that source\'s leads')
  assert.equal(srcBOnly.newSales, 0, 'a person-level filter drops other leads\' sales too')
  const unknownCity = aggregateLeadRecords(records, { range: july, cities: [null] }, 'total')
  assert.equal(unknownCity.rows[0].totalLeads, 1, 'null matches an unknown city (c3)')
  assert.equal(unknownCity.rows[0].sits, 1, 'c3 sat')
  assert.equal(unknownCity.undatedSales, 1, 'c3\'s undated sale')
}
{
  const crossMonth = buildLeadRecords({
    customers: [
      customer('x1', '2026-07-15T17:00:00.000Z'),
      customer('x2', '2026-08-01T07:00:00.000Z'),
      customer('x3', '2026-07-01T07:00:00.000Z'),
    ],
    meetings: [meeting('x1m', 'x1', '2026-08-05T17:00:00.000Z', 'pns', { closerIds: ['u3'] })],
    sales: [sale('x1s', 'x1m', '2026-08-20T17:00:00.000Z', { finalTcpCents: 500_000 })],
  }, NOW)
  const julyRow = aggregateLeadRecords(crossMonth, { range: businessMonthWindow('2026-07') }, 'total').rows[0]
  const augustRow = aggregateLeadRecords(crossMonth, { range: businessMonthWindow('2026-08') }, 'total').rows[0]
  assert.equal(julyRow.totalLeads, 2, 'July has x1 and x3 (at July\'s first instant); x2 at August\'s first instant is excluded')
  assert.equal(julyRow.bookedLeads, 0, 'a July lead who sits in August is not a July booked lead')
  assert.equal(julyRow.newSales, 0, 'nor a July sale')
  assert.equal(julyRow.rates.bookingRate, 0, 'booking rate is 0, not null, when there are leads')
  assert.equal(augustRow.totalLeads, 1, 'x2 lands in August')
  assert.equal(augustRow.bookedLeads, 1, 'the sit is counted in the month it happened')
  assert.equal(augustRow.sits, 1, 'x1 sat in August')
  assert.equal(augustRow.meetings, 1, 'the meeting row lands in August')
  assert.equal(augustRow.newSales, 1, 'the sale is counted in the month it was signed')
  assert.equal(augustRow.revenueNewCents, 500_000, 'its revenue lands in August')
  assert.equal(augustRow.rates.bookingRate, 1, 'same-period booking rate: 1 booked / 1 lead')
  assert.equal(augustRow.hygiene.newSalesWithoutProject, 1, 'x1\'s sale has no project')
}
{
  const own = buildLeadRecords({
    customers: [customer('o1', '2026-07-02T17:00:00.000Z', { city: 'Tustin', zip: '92780' })],
    meetings: [
      meeting('o1a', 'o1', '2026-07-05T17:00:00.000Z', 'pns', { closerIds: ['u5'] }),
      meeting('o1b', 'o1', '2026-07-12T17:00:00.000Z', 'follow_up_needed', { closerIds: ['u6'] }),
      meeting('o1c', 'o1', '2026-07-20T17:00:00.000Z', 'not_set'),
    ],
    sales: [],
  }, NOW)
  const julyWindow = businessMonthWindow('2026-07')
  const byU6 = aggregateLeadRecords(own, { range: julyWindow, closerIds: ['u6'] }, 'total').rows[0]
  assert.equal(byU6.bookedLeads, 0, 'a closer filter tests the booked lead\'s own meeting, not any of the lead\'s meetings')
  assert.equal(byU6.meetings, 1, 'u6 was only on the follow-up')
  const byFollowUp = aggregateLeadRecords(own, { range: julyWindow, outcomes: ['follow_up_needed'] }, 'total').rows[0]
  assert.equal(byFollowUp.bookedLeads, 0, 'an outcome filter tests the booked lead\'s own meeting')
  assert.equal(byFollowUp.meetings, 1, 'one follow-up meeting')
  const ownTotal = aggregateLeadRecords(own, { range: julyWindow }, 'total').rows[0]
  assert.equal(ownTotal.meetings, 3, 'three meeting rows')
  assert.equal(ownTotal.hygiene.unresolvedMeetings, 1, 'the past not_set meeting is unresolved')
  assert.equal(aggregateLeadRecords(own, { range: julyWindow, zips: ['92780'] }, 'total').rows[0].totalLeads, 1, 'a zip filter keeps that zip')
  assert.equal(aggregateLeadRecords(own, { range: julyWindow, zips: ['92618'] }, 'total').rows[0].totalLeads, 0, 'and drops the others')
}
console.log('9. Aggregation ✓')

// ── 10. Bankability ─────────────────────────────────────────────────────────
for (const stage of projectPipelineStages) {
  assert.ok(['net', 'at_risk', 'cancelled'].includes(projectBankability(stage)), `${stage} maps`)
}
assert.equal(projectBankability('on_hold'), 'at_risk', 'on hold is still potential money')
assert.equal(projectBankability('cancelled'), 'cancelled', 'cancelled leaves net')
assert.equal(projectBankability('signed'), 'net', 'a live project is net')
console.log('10. Bankability ✓')

console.log('✅ verify-analytics-rules passed')
