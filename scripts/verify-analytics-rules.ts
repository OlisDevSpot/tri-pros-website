import type { AnalyticsUrlState } from '@/features/analytics/constants/query-parsers'
import type { SpendSource } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'
import type { SaleFact } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

import assert from 'node:assert/strict'

import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { REPORT_TABS } from '@/features/analytics/constants/tabs'
import { aggregateLeadRecords } from '@/features/analytics/lib/aggregate-lead-records'
import { addMonths, lastDayOfMonth, monthsBetween, resolveAnalyticsPeriod } from '@/features/analytics/lib/analytics-periods'
import { computeCosts, findMissingSpend, notApplicableReasons, sourceRowCostReason, spendInRange, totalRevenueCents } from '@/features/analytics/lib/analytics-rules'
import { breakdownColumns } from '@/features/analytics/lib/breakdown-columns'
import { analyticsReportWindow, buildAnalyticsReport } from '@/features/analytics/lib/build-analytics-report'
import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
import { buildFilterFields } from '@/features/analytics/lib/filter-fields'
import { filterUpdate } from '@/features/analytics/lib/filter-update'
import { formatDayRange } from '@/features/analytics/lib/format-analytics'
import { hygieneHref } from '@/features/analytics/lib/hygiene-links'
import { listLeadPlaces } from '@/features/analytics/lib/list-lead-places'
import { formatCentsForInput, parseDollarsToCents } from '@/features/analytics/lib/parse-dollars'
import { metricDisplayText, readMetric, sortRowsByMetric } from '@/features/analytics/lib/read-metric'
import { spendGridRows } from '@/features/analytics/lib/spend-grid-rows'
import { resolveFocus, toReportInput } from '@/features/analytics/lib/to-report-input'
import { buildTrendPoints } from '@/features/analytics/lib/trend-points'
import { analyticsReportInputSchema } from '@/features/analytics/schemas/report-input-schema'
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

  const noCloser = buildLeadRecords({
    customers: [customer('n1', '2026-07-01T17:00:00.000Z')],
    meetings: [meeting('n1m', 'n1', '2026-07-10T17:00:00.000Z', 'converted_to_project', { projectId: 'p9' })],
    sales: [sale('n1s', 'n1m', '2026-07-12T17:00:00.000Z')],
  }, NOW)
  const unassignedRows = aggregateLeadRecords(noCloser, { range: july }, 'closer').rows
  assert.deepEqual(unassignedRows.map(r => r.groupKey), [null], 'a meeting with no closer lands in the unassigned (null) row')
  assert.equal(unassignedRows[0].bookedLeads, 1, 'unassigned: its booked lead')
  assert.equal(unassignedRows[0].meetings, 1, 'unassigned: its meeting')
  assert.equal(unassignedRows[0].newSales, 1, 'unassigned: the sale on that meeting')

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

// ── 11. Periods ─────────────────────────────────────────────────────────────
{
  const period = (p: Parameters<typeof resolveAnalyticsPeriod>[0], now = NOW) => {
    const { firstDay, lastDay } = resolveAnalyticsPeriod(p, now)
    return [firstDay, lastDay]
  }
  assert.deepEqual(period({ period: 'this-month' }), ['2026-09-01', '2026-09-30'], 'this month runs to its calendar end')
  assert.deepEqual(resolveAnalyticsPeriod({ period: 'this-month' }, NOW).range, { from: '2026-09-01T07:00:00.000Z', to: '2026-10-01T07:00:00.000Z' }, 'the range is Pacific midnights, end exclusive')
  assert.deepEqual(period({ period: 'last-month' }), ['2026-08-01', '2026-08-31'], 'last month')
  assert.deepEqual(period({ period: 'this-quarter' }), ['2026-07-01', '2026-09-30'], 'this quarter')
  assert.deepEqual(period({ period: 'last-quarter' }), ['2026-04-01', '2026-06-30'], 'last quarter')
  assert.deepEqual(period({ period: 'ytd' }), ['2026-01-01', '2026-09-26'], 'year to date stops at today')
  assert.deepEqual(resolveAnalyticsPeriod({ period: 'ytd' }, NOW).range, { from: '2026-01-01T08:00:00.000Z', to: '2026-09-27T07:00:00.000Z' }, 'January is PST, September PDT')
  assert.deepEqual(period({ period: 'last-12' }), ['2025-10-01', '2026-09-30'], 'last 12 months include this one')
  assert.deepEqual(resolveAnalyticsPeriod({ period: 'custom', from: '2026-03-05', to: '2026-03-10' }, NOW).range, { from: '2026-03-05T08:00:00.000Z', to: '2026-03-11T07:00:00.000Z' }, 'a custom range across the spring-forward switch')
  const january = new Date('2026-01-15T20:00:00.000Z')
  assert.deepEqual(period({ period: 'last-month' }, january), ['2025-12-01', '2025-12-31'], 'last month rolls back the year')
  assert.deepEqual(period({ period: 'last-quarter' }, january), ['2025-10-01', '2025-12-31'], 'last quarter rolls back the year')
  const lateSept30 = new Date('2026-10-01T05:00:00.000Z')
  assert.deepEqual(period({ period: 'this-month' }, lateSept30), ['2026-09-01', '2026-09-30'], '10 pm Pacific on Sep 30 is still September')
  assert.throws(() => resolveAnalyticsPeriod({ period: 'custom' }, NOW), 'a custom period with no days is a caller bug')
  assert.deepEqual(monthsBetween('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02'], 'months between, inclusive')
  assert.equal(addMonths('2026-01', -1), '2025-12', 'month arithmetic rolls the year')
  assert.equal(lastDayOfMonth('2028-02'), '2028-02-29', 'leap February')
}
console.log('11. Periods ✓')

// ── 12. Merged duplicates ───────────────────────────────────────────────────
{
  const merged = buildLeadRecords({
    customers: [
      customer('d1', '2026-07-02T17:00:00.000Z', { phone: '5550001111' }),
      customer('d1-dup', '2026-07-09T17:00:00.000Z', { phone: '5550001111' }),
      customer('d1-dup2', '2026-08-09T17:00:00.000Z', { email: 'd1@x.com', phone: '5550001111' }),
      customer('d2', '2026-07-03T17:00:00.000Z'),
    ],
    meetings: [meeting('d1m', 'd1-dup', '2026-07-12T17:00:00.000Z', 'pns', { closerIds: ['u1'] })],
    sales: [],
  }, NOW)
  const julyTotal = aggregateLeadRecords(merged, { range: businessMonthWindow('2026-07') }, 'total').rows[0]
  assert.equal(julyTotal.totalLeads, 2, 'three records of one person are one lead')
  assert.equal(julyTotal.mergedRecords, 2, 'its two extra records count as merged duplicates, in the lead\'s month')
  assert.equal(aggregateLeadRecords(merged, { range: businessMonthWindow('2026-08') }, 'total').rows[0].mergedRecords, 0, 'a later duplicate never re-credits another month')
  assert.equal(aggregateLeadRecords(merged, { range: businessMonthWindow('2026-07') }, 'closer').rows[0].mergedRecords, null, 'merged duplicates follow lead applicability')
}
console.log('12. Merged duplicates ✓')

// ── 13. Spend and cost ──────────────────────────────────────────────────────
{
  const srcA: SpendSource = { id: 'src-a', spendMode: 'manual' }
  const srcB: SpendSource = { id: 'src-b', spendMode: 'manual' }
  const srcF: SpendSource = { id: 'src-f', spendMode: 'none' }
  const entries: LeadSourceSpendEntry[] = [
    { leadSourceId: 'src-a', month: '2026-08', amountCents: 300_000 },
    { leadSourceId: 'src-a', month: '2026-09', amountCents: 300_000 },
    { leadSourceId: 'src-f', month: '2026-09', amountCents: 50_000 },
  ]
  const today = '2026-09-26'
  assert.equal(spendInRange([srcA], entries, { first: '2026-08-01', last: '2026-08-31' }, today), 300_000, 'a whole past month counts in full')
  assert.equal(spendInRange([srcA], entries, { first: '2026-09-01', last: '2026-09-30' }, today), 260_000, 'the current month counts only the 26 days lived so far')
  assert.equal(spendInRange([srcA], entries, { first: '2026-08-17', last: '2026-09-10' }, today), 245_161, 'a range splitting two months takes each month\'s share by days (15/31 + 10/30)')
  assert.equal(spendInRange([srcF], entries, { first: '2026-09-01', last: '2026-09-30' }, today), 0, 'a free source costs nothing, whatever was typed')
  assert.equal(spendInRange([srcB], entries, { first: '2026-09-01', last: '2026-09-30' }, today), 0, 'only the given sources count')
  assert.equal(spendInRange([srcA], entries, { first: '2026-10-01', last: '2026-10-31' }, today), 0, 'days not lived yet carry no spend')

  const leads = [
    { leadSourceId: 'src-a', leadAt: '2026-09-05T17:00:00.000Z' },
    { leadSourceId: 'src-b', leadAt: '2026-09-06T17:00:00.000Z' },
    { leadSourceId: 'src-b', leadAt: '2026-09-07T17:00:00.000Z' },
    { leadSourceId: 'src-f', leadAt: '2026-09-08T17:00:00.000Z' },
    { leadSourceId: null, leadAt: '2026-09-09T17:00:00.000Z' },
    { leadSourceId: 'src-a', leadAt: '2026-07-10T17:00:00.000Z' },
    { leadSourceId: 'src-b', leadAt: '2026-08-01T06:30:00.000Z' },
  ]
  assert.deepEqual(
    findMissingSpend([srcA, srcB, srcF], entries, leads, { first: '2026-07-01', last: '2026-09-30' }),
    [{ leadSourceId: 'src-a', month: '2026-07' }, { leadSourceId: 'src-b', month: '2026-07' }, { leadSourceId: 'src-b', month: '2026-09' }],
    'a manual source with a lead and no spend row is missing for that month (23:30 PDT on Jul 31 is July); free and unknown sources never are',
  )
  assert.deepEqual(findMissingSpend([srcA, srcB, srcF], entries, leads, { first: '2026-09-01', last: '2026-09-30' }), [{ leadSourceId: 'src-b', month: '2026-09' }], 'only months inside the days count')
  assert.deepEqual(findMissingSpend([srcA], entries, leads, { first: '2026-08-01', last: '2026-08-31' }), [], 'a source with no lead that month is not missing')

  assert.deepEqual(
    computeCosts(100_000, { totalLeads: 4, bookedLeads: 2, sits: 0, newSales: null }, 500_000),
    { costs: { costPerLead: 25_000, costPerBookedLead: 50_000, costPerSit: null, costPerNewSale: null }, returnOnSpend: 5 },
    'cost per stage is spend ÷ count; zero or unknown counts give no cost',
  )
  assert.equal(computeCosts(0, { totalLeads: 4, bookedLeads: 2, sits: 1, newSales: 1 }, 500_000).returnOnSpend, null, 'revenue over no spend is unknown, not infinite')
  assert.equal(computeCosts(0, { totalLeads: 4, bookedLeads: 2, sits: 1, newSales: 1 }, 500_000).costs.costPerLead, 0, 'a free lead costs $0')
  assert.equal(totalRevenueCents({ revenueNewCents: 1_000_000, revenueUpsellCents: 200_000 }), 1_200_000, 'revenue counts upsells')
  assert.equal(totalRevenueCents({ revenueNewCents: null, revenueUpsellCents: null }), null, 'no sales stage, no revenue')

  const keys = (r: object) => Object.keys(r).sort()
  assert.deepEqual(keys(notApplicableReasons({}, 'leadSource')), [], 'a source view has cost')
  assert.deepEqual(keys(notApplicableReasons({ leadSourceIds: ['src-a'] }, 'month')), [], 'a source filter keeps cost')
  assert.deepEqual(keys(notApplicableReasons({ cities: ['Irvine'] }, 'total')), ['cost'], 'a city filter: spend is not per city')
  assert.deepEqual(keys(notApplicableReasons({}, 'closer')), ['cost', 'leads'], 'grouping by closer: no leads, no cost')
  assert.deepEqual(keys(notApplicableReasons({ outcomes: ['pns'] }, 'total')), ['cost', 'leads', 'sales'], 'an outcome filter: no leads, sales or cost')
  assert.deepEqual(keys(notApplicableReasons({ leadSourceIds: [null] }, 'total')), ['cost'], 'unknown-source leads have no spend: cost is n/a, never $0')
  assert.deepEqual(keys(notApplicableReasons({ leadSourceIds: ['src-a', null] }, 'leadSource')), ['cost'], 'mixing in unknown-source leads would dilute cost per lead')
  assert.equal(sourceRowCostReason(null), notApplicableReasons({ leadSourceIds: [null] }, 'total').cost, 'the unknown-source row says the same thing as the filter')
  assert.equal(sourceRowCostReason('src-a'), undefined, 'a real source row has cost')
}
console.log('13. Spend and cost ✓')

// ── 14. Report ──────────────────────────────────────────────────────────────
{
  const facts = {
    customers: [
      customer('r1', '2026-08-10T17:00:00.000Z', { leadSourceId: 'src-a', phone: '5550002001' }),
      customer('r2', '2026-09-05T17:00:00.000Z', { leadSourceId: 'src-b', phone: '5550002002' }),
      customer('r3', '2026-09-06T17:00:00.000Z', { leadSourceId: 'src-a', phone: '5550002003', city: 'Unknown' }),
      customer('r3-dup', '2026-09-07T17:00:00.000Z', { leadSourceId: 'src-a', phone: '5550002003', city: 'Tustin', zip: '92780' }),
    ],
    meetings: [
      meeting('r1m', 'r1', '2026-08-12T17:00:00.000Z', 'pns', { closerIds: ['u1'] }),
      meeting('r2m', 'r2', '2026-09-08T17:00:00.000Z', 'converted_to_project', { closerIds: ['u2'], projectId: 'p1' }),
      meeting('r3m', 'r3', '2026-09-10T17:00:00.000Z', 'not_set'),
    ],
    sales: [
      sale('r2s', 'r2m', '2026-09-09T17:00:00.000Z', { finalTcpCents: 800_000 }),
      sale('r1s', 'r1m', null),
    ],
  }
  const data = {
    facts,
    sources: [{ id: 'src-a', spendMode: 'manual' as const }, { id: 'src-b', spendMode: 'manual' as const }, { id: 'src-f', spendMode: 'none' as const }],
    spend: [
      { leadSourceId: 'src-a', month: '2026-08', amountCents: 310_000 },
      { leadSourceId: 'src-a', month: '2026-09', amountCents: 300_000 },
    ],
  }

  const report = buildAnalyticsReport(data, { period: 'this-month', filters: {}, groupBy: 'leadSource' }, NOW)
  assert.deepEqual([report.firstDay, report.lastDay], ['2026-09-01', '2026-09-30'], 'the report names its days')
  assert.equal(report.generatedAt, NOW.toISOString(), 'the report carries the instant it was built, for time-dependent links')
  assert.equal(report.headline.totalLeads, 2, 'r2 and r3 (r3-dup merged) lead in September')
  assert.equal(report.headline.mergedRecords, 1, 'r3-dup is a merged duplicate')
  assert.equal(report.headline.revenueCents, 800_000, 'revenue on the headline')
  assert.deepEqual(report.headline.cost, { status: 'missing', missing: [{ leadSourceId: 'src-b', month: '2026-09' }] }, 'src-b brought a lead in September with no spend: the total cost is missing')
  const srcARow = report.breakdown.find(r => r.groupKey === 'src-a')!
  assert.equal(srcARow.cost.status, 'ok', 'src-a has its spend')
  assert.equal(srcARow.cost.status === 'ok' && srcARow.cost.spendCents, 260_000, 'src-a September spend to date (26/30)')
  assert.equal(srcARow.cost.status === 'ok' && srcARow.cost.costs.costPerLead, 260_000, 'one src-a lead so far')
  assert.equal(report.breakdown.find(r => r.groupKey === 'src-b')!.cost.status, 'missing', 'src-b row is missing')
  assert.equal(report.trend.length, 12, 'twelve trend months')
  assert.deepEqual([report.trend[0].month, report.trend[11].month], ['2025-10', '2026-09'], 'the trend ends with the period\'s last month')
  assert.deepEqual(report.trend.filter(t => t.selected).map(t => t.month), ['2026-09'], 'only the period\'s months are selected')
  const august = report.trend.find(t => t.month === '2026-08')!.row
  assert.equal(august.totalLeads, 1, 'r1 led in August')
  assert.equal(august.cost.status === 'ok' && august.cost.spendCents, 310_000, 'a past month counts in full; src-b had no August lead so nothing is missing')
  assert.deepEqual(report.spendMissing, [{ leadSourceId: 'src-b', month: '2026-09' }], 'the Spend tab\'s warning lists every missing source-month in the period and the trend window')
  assert.deepEqual(report.spendGridMonths, report.trend.map(t => t.month), 'nothing is owed outside the trend, so the grid shows the trend\'s twelve months')
  assert.deepEqual(report.hygiene, { meetingsWithoutOutcome: 1, undatedSales: 1, newSalesWithoutProject: 1, unknownCityZip: 1 }, 'hygiene counts all records: r3m unresolved, r1s undated and without a project, r3 has no city')

  const srcAYear = buildAnalyticsReport(data, { period: 'last-12', filters: { leadSourceIds: ['src-a'] }, groupBy: 'month' }, NOW)
  assert.equal(srcAYear.headline.cost.status === 'ok' && srcAYear.headline.cost.spendCents, 570_000, 'a source filter scopes spend: August in full plus September to date')
  assert.equal(srcAYear.headline.cost.status === 'ok' && srcAYear.headline.cost.costs.costPerLead, 285_000, 'two src-a leads over the year')
  assert.equal(srcAYear.breakdown.find(r => r.groupKey === '2026-09')!.cost.status === 'ok', true, 'a month row carries that month\'s cost')

  const byCloser = buildAnalyticsReport(data, { period: 'this-month', filters: {}, groupBy: 'closer' }, NOW)
  assert.ok(byCloser.breakdown.every(r => r.cost.status === 'not_applicable'), 'grouping by closer: every row\'s cost is not applicable')
  assert.equal(byCloser.headline.cost.status, 'missing', 'but the headline total still has cost')
  assert.ok(byCloser.notApplicable.breakdown.leads && !byCloser.notApplicable.headline.leads, 'leads are n/a in the closer breakdown, not in the headline')
  assert.equal(buildAnalyticsReport(data, { period: 'this-month', filters: { cities: ['Tustin'] }, groupBy: 'leadSource' }, NOW).headline.cost.status, 'not_applicable', 'a city filter: no cost')
  assert.equal(buildAnalyticsReport(data, { period: 'this-month', filters: { leadSourceIds: [null] }, groupBy: 'leadSource' }, NOW).headline.cost.status, 'not_applicable', 'the unknown source: no cost, never $0')

  const longAgo = buildAnalyticsReport({ ...data, facts: { ...facts, customers: [...facts.customers, customer('old', '2024-02-10T18:00:00.000Z', { leadSourceId: 'src-b', phone: '5550002099' })] } }, { period: 'custom', from: '2024-01-01', to: '2026-09-30', filters: {}, groupBy: 'leadSource' }, NOW)
  assert.ok(longAgo.spendMissing.some(m => m.month === '2024-02'), 'a missing month the long period touches is listed, though it is older than the trend')
  assert.ok(longAgo.spendGridMonths.includes('2024-02') && longAgo.spendGridMonths.length === 13, 'the grid adds that month to the trend\'s twelve, so the warning can be cleared')
  assert.equal(buildAnalyticsReport(data, { period: 'last-12', filters: {}, groupBy: 'leadSource' }, NOW).breakdown.every(r => r.groupKey !== null), true, 'every fixture lead has a source')

  const future = buildAnalyticsReport(data, { period: 'custom', from: '2026-09-01', to: '2026-11-30', filters: { leadSourceIds: ['src-a'] }, groupBy: 'month' }, NOW)
  const november = future.trend.find(t => t.month === '2026-11')!
  assert.equal(november.selected, true, 'a future month inside the period is selected')
  assert.equal(november.row.totalLeads, 0, 'no leads yet')
  assert.deepEqual(november.row.cost.status === 'ok' && [november.row.cost.spendCents, november.row.cost.costs.costPerLead], [0, null], 'a future month: $0 so far and no cost per lead, never missing')

  const empty = buildAnalyticsReport({ facts: { customers: [], meetings: [], sales: [] }, sources: [], spend: [] }, { period: 'this-month', filters: {}, groupBy: 'leadSource' }, NOW)
  assert.equal(empty.headline.totalLeads, 0, 'no data: zero leads')
  assert.deepEqual(empty.headline.cost.status === 'ok' && [empty.headline.cost.spendCents, empty.headline.cost.costs.costPerLead], [0, null], 'no data: $0 spend and no cost')
  assert.deepEqual(empty.breakdown, [], 'no data: no breakdown rows')

  assert.equal(analyticsReportWindow({ period: 'custom', from: '2024-01-01', to: '2024-03-31' }, NOW).spendMonths.length, 12, 'the trend already covers a short custom period')
  assert.equal(analyticsReportWindow({ period: 'custom', from: '2023-01-01', to: '2024-03-31' }, NOW).spendMonths.length, 15, 'a long custom period reads spend for every month it touches')

  assert.deepEqual(listLeadPlaces(buildLeadRecords(facts, NOW)), { cities: ['Irvine'], zips: ['92618'] }, 'filter choices come from lead anchors; the unknown city is not a choice')

  assert.equal(analyticsReportInputSchema.safeParse({ period: 'custom', filters: {}, groupBy: 'total' }).success, false, 'a custom period needs its days')
  assert.equal(analyticsReportInputSchema.safeParse({ period: 'custom', from: '2026-09-10', to: '2026-09-01', filters: {}, groupBy: 'total' }).success, false, 'days in order')
  assert.equal(analyticsReportInputSchema.safeParse({ period: 'custom', from: '2026-02-30', to: '2026-03-01', filters: {}, groupBy: 'total' }).success, false, 'a day that does not exist')
  assert.equal(analyticsReportInputSchema.safeParse({ period: 'ytd', filters: { leadSourceIds: [null] }, groupBy: 'city' }).success, true, 'null picks the unknown source')
}
console.log('14. Report ✓')

// ── 15. Page state ──────────────────────────────────────────────────────────
{
  const SOURCE = '4b7e1c2a-9d3f-4e5a-8b6c-1d2e3f4a5b6c'
  const base: AnalyticsUrlState = { period: 'this-month', from: '', to: '', source: [], city: [], zip: [], closer: [], outcome: [], order: [], tab: 'overview', groupBy: null, focus: null }
  assert.deepEqual(toReportInput(base), { period: 'this-month', filters: {}, groupBy: 'leadSource' }, 'defaults: this month, no filters, the tab\'s first group-by')
  assert.equal(toReportInput({ ...base, period: 'custom' }).period, 'this-month', 'a custom period with no days falls back to this month')
  assert.equal(toReportInput({ ...base, period: 'custom', from: '2026-13-45', to: '2026-09-30' }).period, 'this-month', 'an impossible day falls back')
  assert.equal(toReportInput({ ...base, period: 'custom', from: '2026-09-30', to: '2026-09-01' }).period, 'this-month', 'days out of order fall back')
  assert.deepEqual(toReportInput({ ...base, period: 'custom', from: '2026-08-17', to: '2026-09-10' }), { period: 'custom', from: '2026-08-17', to: '2026-09-10', filters: {}, groupBy: 'leadSource' }, 'a valid custom period passes its days')
  assert.deepEqual(toReportInput({ ...base, source: [SOURCE, 'unknown', 'not-a-uuid'], city: ['Irvine', 'unknown'] }).filters, { leadSourceIds: [SOURCE, null], cities: ['Irvine', null] }, '"unknown" means no value; a malformed source id is dropped')
  assert.equal(toReportInput({ ...base, tab: 'appointments', groupBy: 'city' }).groupBy, 'closer', 'a group-by the tab does not offer falls back to the tab\'s first')
  assert.equal(toReportInput({ ...base, tab: 'sales', groupBy: 'month' }).groupBy, 'month', 'a group-by the tab offers is kept')
  assert.equal(toReportInput({ ...base, tab: 'spend' }).groupBy, 'leadSource', 'non-report tabs ask for the overview\'s report')
  assert.equal(resolveFocus('overview', null), 'sits', 'overview focuses sits')
  assert.equal(resolveFocus('sales', 'revenueNew'), 'revenueNew', 'a figure on the tab can be focused')
  assert.equal(resolveFocus('leads', 'validLeads'), 'totalLeads', 'a figure that is not available yet cannot be focused')
  assert.equal(resolveFocus('leads', 'sits'), 'totalLeads', 'a figure from another tab falls back')

  assert.deepEqual(filterUpdate('outcome', ['pns', 'bogus']), { outcome: ['pns'] }, 'an outcome the parser does not know is dropped')
  assert.deepEqual(filterUpdate('order', ['first', 'x']), { order: ['first'] }, 'so is a meeting order')
  assert.deepEqual(filterUpdate('city', ['Irvine']), { city: ['Irvine'] }, 'free-text keys pass through')

  const fields = buildFilterFields({ leadSources: [{ id: SOURCE, name: 'Angi', archived: true }], cities: ['Irvine'], zips: [] }, [])
  assert.deepEqual(fields.map(f => f.key), ['source', 'city', 'zip', 'closer', 'outcome', 'order'], 'one field per filter key, in order')
  assert.deepEqual(fields[0].definition.options.map(o => o.label), ['Angi (archived)', 'Unknown source'], 'archived sources are named as such; unknown is always a choice')

  assert.ok(breakdownColumns(REPORT_TABS.overview).includes('costPerSit'), 'the overview breakdown shows cost at every stage')
  assert.ok(breakdownColumns(REPORT_TABS.overview).includes('returnOnSpend'), 'and revenue per $1')
  assert.ok(!breakdownColumns(REPORT_TABS.leads).includes('validLeads'), 'figures not available yet have no column')

  assert.equal(parseDollarsToCents('$1,200.50'), 120_050, 'dollars with a sign and commas')
  assert.equal(parseDollarsToCents('1200'), 120_000, 'whole dollars')
  assert.equal(parseDollarsToCents('$0'), 0, '$0 is a real amount')
  assert.equal(parseDollarsToCents('  '), null, 'blank means not entered')
  for (const junk of ['-5', 'abc', '12.345', '1.2.3']) {
    assert.equal(parseDollarsToCents(junk), 'invalid', `${junk} is rejected`)
  }
  assert.equal(formatCentsForInput(120_050), '1200.50', 'cents shown back with two decimals')
  assert.equal(formatCentsForInput(120_000), '1200', 'whole dollars shown without decimals')

  assert.equal(formatDayRange('2026-09-01', '2026-09-27'), 'Sep 1 – 27, 2026', 'one month')
  assert.equal(formatDayRange('2026-08-17', '2026-09-10'), 'Aug 17 – Sep 10, 2026', 'two months')
  assert.equal(formatDayRange('2025-10-01', '2026-09-30'), 'Oct 1, 2025 – Sep 30, 2026', 'two years')

  const row = (over: Partial<AnalyticsReportRow>): AnalyticsReportRow => ({
    groupKey: 'g',
    overlapsTotal: false,
    totalLeads: 4,
    mergedRecords: 0,
    validLeads: 4,
    junkLeads: null,
    bookedLeads: 2,
    sits: 1,
    meetings: 2,
    newSales: 1,
    totalCloses: 1,
    revenueNewCents: 1_000_000,
    revenueUpsellCents: 0,
    averageTicketCents: 1_000_000,
    rates: { bookingRate: 0.5, sitRate: 0.5, closeRate: 1 },
    hygiene: { unresolvedMeetings: 0, salesWithoutValue: 0, newSalesWithoutProject: 0, unknownCityZip: 0 },
    revenueCents: 1_000_000,
    cost: { status: 'ok', spendCents: 200_000, costs: { costPerLead: 50_000, costPerBookedLead: 100_000, costPerSit: 200_000, costPerNewSale: 200_000 }, returnOnSpend: 5 },
    ...over,
  })
  assert.deepEqual(readMetric('costPerLead', row({}), {}), { kind: 'value', value: 50_000, text: '$500' }, 'cost per lead in dollars')
  assert.deepEqual(readMetric('sitRate', row({}), {}), { kind: 'value', value: 0.5, text: '50%' }, 'a rate in percent')
  assert.deepEqual(readMetric('closeRate', row({ rates: { bookingRate: null, sitRate: null, closeRate: null } }), {}), { kind: 'empty' }, 'a rate over nothing is empty, not 0%')
  assert.deepEqual(readMetric('totalLeads', row({ totalLeads: null }), { leads: 'why' }), { kind: 'not_applicable', reason: 'why' }, 'a not-applicable stage says why')
  assert.deepEqual(readMetric('spend', row({ cost: { status: 'missing', missing: [] } }), {}), { kind: 'missing' }, 'missing spend')
  assert.deepEqual(readMetric('costPerLead', row({ cost: { status: 'not_applicable', reason: 'no source' } }), {}), { kind: 'not_applicable', reason: 'no source' }, 'a row-level cost reason')
  assert.equal(readMetric('validLeads', row({}), {}).kind, 'not_yet', 'valid leads wait for lead quality')
  assert.deepEqual(['$500', '—', 'n/a', 'missing', 'not available yet'], [
    metricDisplayText(readMetric('costPerLead', row({}), {})),
    metricDisplayText({ kind: 'empty' }),
    metricDisplayText({ kind: 'not_applicable', reason: 'why' }),
    metricDisplayText({ kind: 'missing' }),
    metricDisplayText({ kind: 'not_yet', source: 'lead quality' }),
  ], 'every display reads as one short string (chart tooltips)')
  assert.deepEqual(
    sortRowsByMetric([row({ groupKey: 'a', sits: 1 }), row({ groupKey: 'b', sits: 3 }), row({ groupKey: 'c', cost: { status: 'missing', missing: [] } }), row({ groupKey: 'd', sits: 3 })], 'sits', {}).map(r => r.groupKey),
    ['b', 'd', 'a', 'c'],
    'highest first, ties keep their order',
  )
  assert.deepEqual(
    sortRowsByMetric([row({ groupKey: 'a', cost: { status: 'missing', missing: [] } }), row({ groupKey: 'b' })], 'costPerLead', {}).map(r => r.groupKey),
    ['b', 'a'],
    'rows without a value sort last',
  )

  const emptyReport = buildAnalyticsReport({ facts: { customers: [], meetings: [], sales: [] }, sources: [], spend: [] }, { period: 'this-month', filters: {}, groupBy: 'leadSource' }, NOW)
  const points = buildTrendPoints(emptyReport, 'sits')
  assert.deepEqual([points.length, points[11].label, points[11].selected, points[11].value], [12, 'Sep', true, 0], 'twelve points, the period\'s month selected, a zero is a value')

  const grid = spendGridRows(
    [
      { id: 'paid', name: 'Angi', spendMode: 'manual', archived: false },
      { id: 'old-owed', name: 'Old vendor', spendMode: 'manual', archived: true },
      { id: 'old-done', name: 'Gone vendor', spendMode: 'manual', archived: true },
      { id: 'free', name: 'Referral', spendMode: 'none', archived: false },
      { id: 'free-old', name: 'Walk-in', spendMode: 'none', archived: true },
    ],
    [],
    [{ leadSourceId: 'old-owed', month: '2026-08' }],
  )
  assert.deepEqual(grid.tracked.map(s => s.id), ['paid', 'old-owed'], 'an archived source still owed spend keeps its row, or its warning could never clear')
  assert.deepEqual(grid.free.map(s => s.id), ['free'], 'archived free sources are not listed')

  assert.equal(hygieneHref('meetingsWithoutOutcome', NOW.toISOString()), '/dashboard/meetings?pm_outcome=not_set&pm_scheduledFor=%7B%22to%22%3A%222026-09-26T19%3A00%3A00.000Z%22%7D', 'past meetings with no outcome, cut off at the report\'s instant')
  assert.equal(hygieneHref('undatedSales', NOW.toISOString()), '/dashboard/proposals?pp_status=approved&pp_missingApprovedAt=true', 'undated sales')
  assert.equal(hygieneHref('newSalesWithoutProject', NOW.toISOString()), '/dashboard/proposals?pp_kind=initial-sale&pp_status=approved&pp_noProject=true', 'new sales without a project')
  assert.equal(hygieneHref('unknownCityZip', NOW.toISOString()), null, 'no customers filter for unknown places yet')
}
console.log('15. Page state ✓')

console.log('✅ verify-analytics-rules passed')
