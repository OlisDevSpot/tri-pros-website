# Analytics Spec A — Lead Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the analytics rule layer — named rule exports, three read-only fact loaders, the per-person lead record (`LeadRecord`) and one aggregator — so every later analytics number comes from one chain. No UI, no router, no schema change.

**Architecture:** Each rule is one named export in the entity or module that owns its table (sit map in meetings enums, person grouping in the customers entity, sale in the proposals module, bankability in the projects module). The analytics feature (`src/features/analytics/`) owns only composition rules (`lib/analytics-rules.ts`), the builder (`lib/build-lead-records.ts`) and the aggregator (`lib/aggregate-lead-records.ts`); the builder and aggregator contain no rule logic of their own. A pure fixture script pins every rule.

**Tech Stack:** TypeScript (strict), Drizzle ORM (Postgres/Neon), `tsx` for the verify script, `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-26-analytics-a-lead-rules-design.md` (owner-approved 2026-09-26). **Tracker:** `docs/plans/2026-09-26-analytics-epic.md` (IDs A*, C*; naming per C42–C43). Read both before starting.

## Global Constraints

- **Branch:** local `main` (house rule). The tree has unrelated uncommitted files. Stage **by explicit path only**. Never `git add -A`, `git add .`, `git stash`, `git checkout -- .` or `git reset`.
- **Gates on every commit:** `pnpm tsc` and `pnpm lint` pass, and `pnpm tsx scripts/verify-analytics-rules.ts` passes once it exists. Never run `pnpm build`. Fix style with `pnpm exec eslint --fix <the files you touched>`, never a repo-wide `--fix`.
- **No data writes.** Every DB access in this plan is a `SELECT`. No seed, no update, no `db:push`.
- **Pure libs stay pure:** `business-time.ts`, `email.ts`, `group-duplicate-people.ts`, `sale.ts`, `bankability.ts`, `analytics-rules.ts`, `build-lead-records.ts`, `aggregate-lead-records.ts` import no DB, tRPC, React or `next/*`. They may import **types** from the DAL files, always with `import type` (so the verify script never loads the DB).
- **`shared/` never imports from `features/`.**
- **Rule-keeping contract (C38):** every rule is one named export with a one-line comment giving the business *why*. The builder and aggregator call rules and hold no rule logic inline.
- **Comments say why, never what.** No file banners. Never cite a plan, spec, tracker ID (C*, A*) or doc in code.
- **Timestamps are ISO strings downstream of the loaders.** Postgres returns `'2026-07-01 17:00:00+00'`; each loader converts with `new Date(x).toISOString()`.
- **Imports:** absolute `@/…` paths, type imports first, as in the surrounding code. Named exports only.
- **Verify script:** `scripts/verify-analytics-rules.ts`, `node:assert/strict`, one numbered `console.log('N. <name> ✓')` per section (numbers are the spec §6 numbers), final line `console.log('✅ verify-analytics-rules passed')`. **No `/* eslint-disable no-console */`** — `no-console` is not active on `scripts/`, so the directive would itself warn (spec §6 wording superseded). A failed `assert` throws and exits non-zero.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

Inputs the spec implies but no rule states outright. Each has a test in the task that owns the code.

1. **Postgres timestamp strings are not ISO.** `'2026-09-26 17:00:00+00'` sorts wrong against `'2026-09-26T…Z'`. Loaders normalize; Task 5's smoke step asserts every loaded timestamp ends in `Z`.
2. **The lead is on one record and the meetings on its duplicate.** A person whose earliest record has no meetings, while a later duplicate (same phone) has them, must still get the booked lead and sales (A3). Test: Task 6.
3. **Two meetings scheduled at the same instant.** Order must be deterministic (ties by id), or `first` / booked lead flips between reads. Test: Task 6.
4. **An event at 11 pm Pacific on the last day of a month** lands in that month, not the next (UTC would say next). Test: Task 7 (month grouping).
5. **No data at all** (no customers, or a filter matching nobody) returns one all-zero total row with every rate `null`, never a crash or `NaN`. Test: Task 7.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/shared/lib/business-time.ts` (new) | Pacific business-day and month helpers | 1 |
| `src/features/agent-dashboard/lib/meeting-windows.ts` (modify) | dashboard windows, rebuilt on `business-time` | 1 |
| `src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx`, `dashboard-meetings-hub.tsx`, `src/app/(frontend)/dashboard/page.tsx` (modify) | import day helpers from `shared/lib/business-time` | 1 |
| `scripts/verify-analytics-rules.ts` (new) | rule checks, one section per rule | 1–4, 6, 7 |
| `src/shared/constants/enums/meetings.ts` (modify) | `MeetingSit`, `MEETING_OUTCOME_SIT`, `isSit`, `isProjectMeeting` | 2 |
| `src/shared/lib/email.ts` (new) | `normalizeEmail` | 3 |
| `src/shared/entities/customers/lib/group-duplicate-people.ts` (new) | `compareRecordAge`, `groupDuplicatePeople` | 3 |
| `src/shared/modules/proposals/core/lib/sale.ts` (new) | `SALE_STATUS`, `SaleKind`, `classifySale` | 4 |
| `src/shared/modules/projects/core/lib/bankability.ts` (new) | `ProjectBankability`, `projectBankability` | 4 |
| `src/shared/entities/customers/dal/server/analytics-facts.ts` (new) | `CustomerFact`, `listCustomerFacts` | 5 |
| `src/shared/entities/meetings/dal/server/analytics-facts.ts` (new) | `MeetingFact`, `listMeetingFacts` | 5 |
| `src/shared/modules/proposals/core/dal/server/analytics-facts.ts` (new) | `SaleFact`, `listSaleFacts` | 5 |
| `src/shared/entities/customers/lib/derived-pipeline-sql.ts`, `signed-customer-sql.ts` (modify) | one `EXISTS_PROJECT` | 5 |
| `src/features/analytics/types.ts` (new) | `AnalyticsFacts` (Task 5); person-record and aggregate types (Tasks 6, 7) | 5, 6, 7 |
| `src/features/analytics/dal/server/load-analytics-facts.ts` (new) | `loadAnalyticsFacts` | 5 |
| `src/features/analytics/lib/analytics-rules.ts` (new) | `UNKNOWN_PLACE_VALUES`, `toKnownPlace`, `pickLeadAnchor`, `deriveMeetingOrder`, `pickBookedLead` (Task 6); `ANALYTICS_RATES`, `computeRate` (Task 7) | 6, 7 |
| `src/features/analytics/lib/build-lead-records.ts` (new) | `buildLeadRecords` | 6 |
| `src/features/analytics/lib/aggregate-lead-records.ts` (new) | `aggregateLeadRecords` | 7 |
| `CONTEXT.md` (modify) | `## Analytics terms` rule index | 8 |

**Two refinements of the spec's signatures, decided here** (they make the spec's own rules expressible; no rule changes):
- `buildLeadRecords` returns `LeadRecordSet = { leads, orphans }` (not a bare array), so orphans reach the aggregator.
- `aggregateLeadRecords` returns `AnalyticsResult = { rows, undatedSales, orphans }`. Undated sales and orphans have no date or group, so they are top-level; the other hygiene counts stay per row. `range` is optional: absent = all time, where undated sales **do** count (C32 "counted in all-time totals") and fall in the `null` month bucket.
- The spec's `UNKNOWN_CITY_VALUES` is named `UNKNOWN_PLACE_VALUES` (it covers zip too).

---

### Task 1: Pacific business-time helpers

**Files:**
- Create: `src/shared/lib/business-time.ts`
- Modify: `src/features/agent-dashboard/lib/meeting-windows.ts` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx:7`, `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx:8`, `src/app/(frontend)/dashboard/page.tsx:2`
- Create: `scripts/verify-analytics-rules.ts`

**Interfaces:**
- Produces: `BUSINESS_TIMEZONE: 'America/Los_Angeles'`; `startOfDayInTimeZone(calendarDay: string, timeZone: string): Date`; `addCalendarDays(calendarDay: string, days: number): string`; `businessDayKey(date: Date): string`; `businessToday(): string`; `businessMonthKey(date: Date | string): string` (`'YYYY-MM'`); `businessMonthWindow(monthKey: string): { from: string, to: string }` (ISO, `[from, to)`).

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-analytics-rules.ts`:

```ts
import assert from 'node:assert/strict'

import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { businessMonthKey, businessMonthWindow } from '@/shared/lib/business-time'

// ── 7. Pacific months ───────────────────────────────────────────────────────
assert.equal(businessMonthKey('2026-08-01T05:30:00.000Z'), '2026-07', 'July 31 22:30 PDT is July')
assert.equal(businessMonthKey(new Date('2026-08-01T07:00:00.000Z')), '2026-08', 'Aug 1 00:00 PDT is August')
assert.deepEqual(businessMonthWindow('2026-03'), { from: '2026-03-01T08:00:00.000Z', to: '2026-04-01T07:00:00.000Z' }, 'March spans the spring-forward switch')
assert.deepEqual(businessMonthWindow('2026-11'), { from: '2026-11-01T07:00:00.000Z', to: '2026-12-01T08:00:00.000Z' }, 'November spans the fall-back switch')
assert.deepEqual(businessMonthWindow('2026-12'), { from: '2026-12-01T08:00:00.000Z', to: '2027-01-01T08:00:00.000Z' }, 'December rolls the year')
assert.deepEqual(meetingMonthWindow('2026-03-15'), businessMonthWindow('2026-03'), 'dashboard month window is the business month window')
console.log('7. Pacific months ✓')

console.log('✅ verify-analytics-rules passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `@/shared/lib/business-time`.

- [ ] **Step 3: Create `src/shared/lib/business-time.ts`**

```ts
// Day and month boundaries are pinned to the business timezone, never the
// runtime's: Vercel runs in UTC while agents are in Southern California, and a
// UTC boundary puts a 10 pm Pacific event in the next day or month.

export const BUSINESS_TIMEZONE = 'America/Los_Angeles'

/**
 * The UTC offset (ms, positive east of UTC) `timeZone` had at `instant`,
 * read back through Intl because the offset itself moves with DST.
 */
function utcOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const get = (type: string) => Number(parts.find(part => part.type === type)?.value)
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asIfUtc - instant.getTime()
}

/**
 * The UTC instant of local midnight on `timeZone`'s `YYYY-MM-DD` day. Two-pass
 * offset resolution: the offset can depend on the instant (DST), so refine once
 * against the first guess — enough because Pacific transitions happen at 2 am.
 */
export function startOfDayInTimeZone(calendarDay: string, timeZone: string): Date {
  const [year, month, day] = calendarDay.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day, 0, 0, 0)

  let instantMs = target - utcOffsetMs(new Date(target), timeZone)
  instantMs = target - utcOffsetMs(new Date(instantMs), timeZone)

  return new Date(instantMs)
}

/**
 * Calendar-date arithmetic, deliberately not "add 24h to midnight": a DST day
 * is 23h or 25h long and that would land on the wrong date.
 */
export function addCalendarDays(calendarDay: string, days: number): string {
  const [year, month, day] = calendarDay.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function businessDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE })
}

export function businessToday(): string {
  return businessDayKey(new Date())
}

export function businessMonthKey(date: Date | string): string {
  return businessDayKey(new Date(date)).slice(0, 7)
}

export function businessMonthWindow(monthKey: string): { from: string, to: string } {
  const [year, month] = monthKey.split('-').map(Number)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return {
    from: startOfDayInTimeZone(start, BUSINESS_TIMEZONE).toISOString(),
    to: startOfDayInTimeZone(nextStart, BUSINESS_TIMEZONE).toISOString(),
  }
}
```

- [ ] **Step 4: Replace `src/features/agent-dashboard/lib/meeting-windows.ts` with**

```ts
// `meetingWindow('today')` runs both server-side (RSC prefetch in Vercel's UTC
// runtime) and in the agent's browser. Deriving "today" from ambient local time
// would give server and client different query keys near the UTC/PT offset and
// a hydration mismatch, so every boundary comes from the business timezone.

import { addCalendarDays, BUSINESS_TIMEZONE, businessMonthWindow, businessToday, startOfDayInTimeZone } from '@/shared/lib/business-time'

export type MeetingWindowKind = 'today' | 'upcoming' | 'past'

/** LA-pinned ISO bounds [startOfMonth, startOfNextMonth) for the meetings scheduledFor filter. */
export function meetingMonthWindow(anchorCalendarDay: string): { from: string, to: string } {
  return businessMonthWindow(anchorCalendarDay.slice(0, 7))
}

/** ISO bounds for the meetings `scheduledFor` dateRange filter, business-day based. */
export function meetingWindow(kind: MeetingWindowKind): { from?: string, to?: string } {
  const todayCalendarDay = businessToday()
  const tomorrowCalendarDay = addCalendarDays(todayCalendarDay, 1)

  const startOfToday = startOfDayInTimeZone(todayCalendarDay, BUSINESS_TIMEZONE)
  const startOfTomorrow = startOfDayInTimeZone(tomorrowCalendarDay, BUSINESS_TIMEZONE)

  switch (kind) {
    case 'today':
      return { from: startOfToday.toISOString(), to: startOfTomorrow.toISOString() }
    case 'upcoming':
      return { from: startOfTomorrow.toISOString() }
    case 'past':
      return { to: startOfToday.toISOString() }
  }
}
```

- [ ] **Step 5: Repoint the three day-helper consumers**

- `dashboard-meetings-calendar.tsx:7`: `import { businessDayKey } from '@/shared/lib/business-time'`
- `dashboard-meetings-hub.tsx:8`: `import { businessDayKey, businessToday } from '@/shared/lib/business-time'`
- `src/app/(frontend)/dashboard/page.tsx:2`: `import { businessToday } from '@/shared/lib/business-time'`

`constants/dashboard-queries.ts` keeps importing `meetingWindow` / `meetingMonthWindow` from `../lib/meeting-windows` — no change. Then `pnpm exec eslint --fix` on the five touched `src` files (import order moves).

- [ ] **Step 6: Run the check and gates**

Run: `pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: `7. Pacific months ✓`, `✅ verify-analytics-rules passed`; tsc and lint clean. Also `grep -rn "meeting-windows'" src` shows only `dashboard-queries.ts` and the script.

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/business-time.ts src/features/agent-dashboard/lib/meeting-windows.ts src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx "src/app/(frontend)/dashboard/page.tsx" scripts/verify-analytics-rules.ts
git commit -m "refactor(time): shared Pacific business-time helpers with month windows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sit map and project-meeting rule

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts` (append after `MEETING_OUTCOME_SENTIMENT` / `isNegativeOutcome`, around line 107)
- Modify: `scripts/verify-analytics-rules.ts`

**Interfaces:**
- Produces: `type MeetingSit = 'sat' | 'not_sat' | 'unknown'`; `MEETING_OUTCOME_SIT: Record<MeetingOutcome, MeetingSit>`; `isSit(outcome: MeetingOutcome): boolean`; `isProjectMeeting(meeting: { meetingType: MeetingType }): boolean`.

- [ ] **Step 1: Add the failing checks**

Add to the script's imports:

```ts
import { isProjectMeeting, isSit, MEETING_OUTCOME_SIT, meetingOutcomes } from '@/shared/constants/enums/meetings'
```

Insert before the `7. Pacific months` section:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — `MEETING_OUTCOME_SIT` / `isSit` / `isProjectMeeting` are not exported.

- [ ] **Step 3: Add the rules to `src/shared/constants/enums/meetings.ts`** (after `isNegativeOutcome`)

```ts
export type MeetingSit = 'sat' | 'not_sat' | 'unknown'

/**
 * Whether the rep physically met the homeowner. Orthogonal to sentiment: a lost
 * or pending deal still sat. not_set is unknown and never counts as a sit.
 */
export const MEETING_OUTCOME_SIT: Record<MeetingOutcome, MeetingSit> = {
  not_set: 'unknown',
  not_good: 'sat',
  pns: 'sat',
  npns: 'sat',
  ftd: 'sat',
  lost_to_competitor: 'sat',
  follow_up_needed: 'sat',
  proposal_created: 'sat',
  proposal_sent: 'sat',
  converted_to_project: 'sat',
  additional_work: 'sat',
  no_show: 'not_sat',
  cancelled: 'not_sat',
  reschedule_needed: 'not_sat',
  nra: 'not_sat',
}

export function isSit(outcome: MeetingOutcome): boolean {
  return MEETING_OUTCOME_SIT[outcome] === 'sat'
}

/**
 * A project meeting serves an existing project (visits, upsells — additional_work
 * only ever happens here); every other meeting works a lead toward its sale, so
 * only those can book the lead or count as its sit.
 */
export function isProjectMeeting(meeting: { meetingType: MeetingType }): boolean {
  return meeting.meetingType === 'Project'
}
```

- [ ] **Step 4: Run the check and gates**

Run: `pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: `3. Sit map ✓`, `4. Project meeting ✓`, `7. Pacific months ✓`, `✅ …`; tsc and lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants/enums/meetings.ts scripts/verify-analytics-rules.ts
git commit -m "feat(meetings): sit classification and project-meeting rule

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Person identity (email normalizer + duplicate grouping)

**Files:**
- Create: `src/shared/lib/email.ts`
- Create: `src/shared/entities/customers/lib/group-duplicate-people.ts`
- Modify: `scripts/verify-analytics-rules.ts`

**Interfaces:**
- Consumes: `toNationalDigits(input: string | null | undefined): string | null` from `@/shared/lib/phone`.
- Produces: `normalizeEmail(raw: string | null | undefined): string | null`; `interface PersonIdentityRow { id: string, phone: string | null, email: string | null, createdAt: string }`; `compareRecordAge(a: { id: string, createdAt: string }, b: { id: string, createdAt: string }): number`; `groupDuplicatePeople(rows: readonly PersonIdentityRow[]): Map<string, string>` (customerId → personId = id of the group's earliest record).

- [ ] **Step 1: Add the failing checks**

Add imports:

```ts
import { groupDuplicatePeople } from '@/shared/entities/customers/lib/group-duplicate-people'
import { normalizeEmail } from '@/shared/lib/email'
```

Insert as the first section (before `3. Sit map`):

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `@/shared/lib/email`.

- [ ] **Step 3: Create `src/shared/lib/email.ts`**

```ts
// Customer emails are stored as typed; matching people needs one canonical form.
export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase()
  return email || null
}
```

- [ ] **Step 4: Create `src/shared/entities/customers/lib/group-duplicate-people.ts`**

```ts
import { normalizeEmail } from '@/shared/lib/email'
import { toNationalDigits } from '@/shared/lib/phone'

export interface PersonIdentityRow {
  id: string
  phone: string | null
  email: string | null
  createdAt: string
}

/** Earliest record first, ties by id, so a person's id and anchor are stable across reads. */
export function compareRecordAge(a: { id: string, createdAt: string }, b: { id: string, createdAt: string }): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  if (byTime !== 0) {
    return byTime
  }
  if (a.id === b.id) {
    return 0
  }
  return a.id < b.id ? -1 : 1
}

/**
 * One person = records sharing a normalized phone OR email, chained (a~b by
 * phone and b~c by email make one person), since there is no dedup at intake.
 * Returns customerId → personId, where personId is the group's earliest record.
 */
export function groupDuplicatePeople(rows: readonly PersonIdentityRow[]): Map<string, string> {
  const sorted = [...rows].sort(compareRecordAge)
  const age = new Map(sorted.map((row, index) => [row.id, index]))
  const parent = new Map(sorted.map(row => [row.id, row.id]))

  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) {
      root = parent.get(root)!
    }
    let node = id
    while (node !== root) {
      const next = parent.get(node)!
      parent.set(node, root)
      node = next
    }
    return root
  }

  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) {
      return
    }
    // The older root always wins, so the root is the group's earliest record.
    if (age.get(rootA)! < age.get(rootB)!) {
      parent.set(rootB, rootA)
    }
    else {
      parent.set(rootA, rootB)
    }
  }

  const firstIdByKey = new Map<string, string>()
  for (const row of sorted) {
    const phone = toNationalDigits(row.phone)
    const email = normalizeEmail(row.email)
    const keys = [phone && `phone:${phone}`, email && `email:${email}`].filter((key): key is string => !!key)
    for (const key of keys) {
      const firstId = firstIdByKey.get(key)
      if (firstId) {
        union(firstId, row.id)
      }
      else {
        firstIdByKey.set(key, row.id)
      }
    }
  }

  return new Map(sorted.map(row => [row.id, find(row.id)]))
}
```

- [ ] **Step 5: Run the check and gates**

Run: `pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: `1. Grouping ✓` plus the earlier sections and `✅ …`; tsc and lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/email.ts src/shared/entities/customers/lib/group-duplicate-people.ts scripts/verify-analytics-rules.ts
git commit -m "feat(customers): person identity by chained phone or email

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Sale and bankability rules

**Files:**
- Create: `src/shared/modules/proposals/core/lib/sale.ts`
- Create: `src/shared/modules/projects/core/lib/bankability.ts`
- Modify: `scripts/verify-analytics-rules.ts`

**Interfaces:**
- Consumes: `ProposalKind`, `ProposalStatus` from `@/shared/constants/enums/proposals`; `deriveProjectStatusBucket`, `projectPipelineStages` from `@/shared/constants/enums/pipelines`.
- Produces: `SALE_STATUS: 'approved'`; `type SaleKind = 'new' | 'upsell'`; `interface SaleClassification { kind: SaleKind, at: string | null, valueCents: number | null }`; `classifySale(row: { kind: ProposalKind, approvedAt: string | null, finalTcpCents: number | null }): SaleClassification`; `type ProjectBankability = 'net' | 'at_risk' | 'cancelled'`; `projectBankability(stage: string | null | undefined): ProjectBankability`.

- [ ] **Step 1: Add the failing checks**

Add imports:

```ts
import { projectPipelineStages } from '@/shared/constants/enums/pipelines'
import { projectBankability } from '@/shared/modules/projects/core/lib/bankability'
import { classifySale, SALE_STATUS } from '@/shared/modules/proposals/core/lib/sale'
```

Insert after `7. Pacific months`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `…/bankability`.

- [ ] **Step 3: Create `src/shared/modules/proposals/core/lib/sale.ts`**

```ts
import type { ProposalKind, ProposalStatus } from '@/shared/constants/enums/proposals'

/** Signing the contract (Zoho completion) or a manual approve is what makes a sale. */
export const SALE_STATUS = 'approved' as const satisfies ProposalStatus

export type SaleKind = 'new' | 'upsell'

export interface SaleClassification {
  kind: SaleKind
  at: string | null
  valueCents: number | null
}

/**
 * Dated at approval with no fallback date, and a null value stays null (not
 * computed, not $0): an undated or unpriced sale must surface as a data fix.
 */
export function classifySale(row: { kind: ProposalKind, approvedAt: string | null, finalTcpCents: number | null }): SaleClassification {
  return {
    kind: row.kind === 'initial-sale' ? 'new' : 'upsell',
    at: row.approvedAt,
    valueCents: row.finalTcpCents,
  }
}
```

- [ ] **Step 4: Create `src/shared/modules/projects/core/lib/bankability.ts`**

```ts
import { deriveProjectStatusBucket } from '@/shared/constants/enums/pipelines'

export type ProjectBankability = 'net' | 'at_risk' | 'cancelled'

/** On hold is paused, not lost: it stays in net and is flagged at risk; only a cancellation leaves net. */
export function projectBankability(stage: string | null | undefined): ProjectBankability {
  switch (deriveProjectStatusBucket(stage)) {
    case 'cancelled':
      return 'cancelled'
    case 'on_hold':
      return 'at_risk'
    default:
      return 'net'
  }
}
```

- [ ] **Step 5: Run the check and gates**

Run: `pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: `8. Sales (classification) ✓`, `10. Bankability ✓` with the earlier sections and `✅ …`; tsc and lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/modules/proposals/core/lib/sale.ts src/shared/modules/projects/core/lib/bankability.ts scripts/verify-analytics-rules.ts
git commit -m "feat(proposals,projects): sale classification and project bankability rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Fact loaders

**Files:**
- Create: `src/shared/entities/customers/dal/server/analytics-facts.ts`
- Create: `src/shared/entities/meetings/dal/server/analytics-facts.ts`
- Create: `src/shared/modules/proposals/core/dal/server/analytics-facts.ts`
- Create: `src/features/analytics/types.ts`
- Create: `src/features/analytics/dal/server/load-analytics-facts.ts`
- Modify: `src/shared/entities/customers/lib/derived-pipeline-sql.ts:14` (export `EXISTS_PROJECT`)
- Modify: `src/shared/entities/customers/lib/signed-customer-sql.ts` (whole file)

**Interfaces:**
- Consumes: `dalDbOperation`, `dalVerifySuccess` (`@/shared/dal/server/lib/helpers`); `DalReturn` (`@/shared/dal/server/types`); `getAllParticipantsForMeetings(meetingIds: string[]): Promise<MeetingParticipantRow[]>` (`./participants`); `SALE_STATUS` (Task 4); `MeetingType`, `MeetingOutcome` (enums); `ProposalKind`.
- Produces:
  - `interface CustomerFact { id: string, phone: string | null, email: string | null, createdAt: string, leadSourceId: string | null, city: string, zip: string }`; `listCustomerFacts(): Promise<DalReturn<CustomerFact[]>>`
  - `interface MeetingFact { id: string, customerId: string | null, meetingType: MeetingType, meetingOutcome: MeetingOutcome, scheduledFor: string, projectId: string | null, closerIds: string[] }`; `listMeetingFacts(): Promise<DalReturn<MeetingFact[]>>`
  - `interface SaleFact { id: string, meetingId: string | null, kind: ProposalKind, approvedAt: string | null, finalTcpCents: number | null }`; `listSaleFacts(): Promise<DalReturn<SaleFact[]>>`
  - `interface AnalyticsFacts { customers: CustomerFact[], meetings: MeetingFact[], sales: SaleFact[] }` in `src/features/analytics/types.ts`; `loadAnalyticsFacts(): Promise<DalReturn<AnalyticsFacts>>`
  - All timestamps ISO (`…Z`).

- [ ] **Step 1: Create `src/shared/entities/customers/dal/server/analytics-facts.ts`**

```ts
import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'

export interface CustomerFact {
  id: string
  phone: string | null
  email: string | null
  createdAt: string
  leadSourceId: string | null
  city: string
  zip: string
}

// System-level read: every customer, unscoped — analytics callers are super-admin gated at the router.
export async function listCustomerFacts(): Promise<DalReturn<CustomerFact[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        id: customers.id,
        phone: customers.phone,
        email: customers.email,
        createdAt: customers.createdAt,
        leadSourceId: customers.leadSourceId,
        city: customers.city,
        zip: customers.zip,
      })
      .from(customers)
    // Postgres returns '2026-07-01 17:00:00+00'; downstream compares ISO strings.
    return rows.map(row => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }))
  })
}
```

- [ ] **Step 2: Create `src/shared/entities/meetings/dal/server/analytics-facts.ts`**

```ts
import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums/meetings'
import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'

import { getAllParticipantsForMeetings } from './participants'

export interface MeetingFact {
  id: string
  customerId: string | null
  meetingType: MeetingType
  meetingOutcome: MeetingOutcome
  scheduledFor: string
  projectId: string | null
  closerIds: string[]
}

// System-level read: every meeting, unscoped — analytics callers are super-admin gated at the router.
export async function listMeetingFacts(): Promise<DalReturn<MeetingFact[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        id: meetings.id,
        customerId: meetings.customerId,
        meetingType: meetings.meetingType,
        meetingOutcome: meetings.meetingOutcome,
        scheduledFor: meetings.scheduledFor,
        projectId: meetings.projectId,
      })
      .from(meetings)

    const participants = await getAllParticipantsForMeetings(rows.map(row => row.id))
    const closerIdsByMeeting = new Map<string, string[]>()
    for (const participant of participants) {
      const closerIds = closerIdsByMeeting.get(participant.meetingId) ?? []
      closerIds.push(participant.userId)
      closerIdsByMeeting.set(participant.meetingId, closerIds)
    }

    // Postgres returns '2026-07-01 17:00:00+00'; downstream compares ISO strings.
    return rows.map(row => ({
      ...row,
      scheduledFor: new Date(row.scheduledFor).toISOString(),
      closerIds: closerIdsByMeeting.get(row.id) ?? [],
    }))
  })
}
```

- [ ] **Step 3: Create `src/shared/modules/proposals/core/dal/server/analytics-facts.ts`**

```ts
import type { ProposalKind } from '@/shared/constants/enums/proposals'
import type { DalReturn } from '@/shared/dal/server/types'

import { eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'
import { SALE_STATUS } from '@/shared/modules/proposals/core/lib/sale'

export interface SaleFact {
  id: string
  meetingId: string | null
  kind: ProposalKind
  approvedAt: string | null
  finalTcpCents: number | null
}

// System-level read: every sale, unscoped — analytics callers are super-admin gated at the router.
export async function listSaleFacts(): Promise<DalReturn<SaleFact[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        id: proposals.id,
        meetingId: proposals.meetingId,
        kind: proposals.kind,
        approvedAt: proposals.approvedAt,
        finalTcpCents: proposals.finalTcpCents,
      })
      .from(proposals)
      .where(eq(proposals.status, SALE_STATUS))
    // Postgres returns '2026-07-01 17:00:00+00'; downstream compares ISO strings.
    return rows.map(row => ({ ...row, approvedAt: row.approvedAt === null ? null : new Date(row.approvedAt).toISOString() }))
  })
}
```

- [ ] **Step 4: Create `src/features/analytics/types.ts`**

```ts
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'
import type { SaleFact } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

export interface AnalyticsFacts {
  customers: CustomerFact[]
  meetings: MeetingFact[]
  sales: SaleFact[]
}
```

- [ ] **Step 5: Create `src/features/analytics/dal/server/load-analytics-facts.ts`**

```ts
import type { AnalyticsFacts } from '@/features/analytics/types'
import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { listCustomerFacts } from '@/shared/entities/customers/dal/server/analytics-facts'
import { listMeetingFacts } from '@/shared/entities/meetings/dal/server/analytics-facts'
import { listSaleFacts } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

export async function loadAnalyticsFacts(): Promise<DalReturn<AnalyticsFacts>> {
  return dalDbOperation(async () => {
    const [customers, meetings, sales] = await Promise.all([listCustomerFacts(), listMeetingFacts(), listSaleFacts()])
    return {
      customers: dalVerifySuccess(customers),
      meetings: dalVerifySuccess(meetings),
      sales: dalVerifySuccess(sales),
    }
  })
}
```

- [ ] **Step 6: One `EXISTS_PROJECT`**

In `src/shared/entities/customers/lib/derived-pipeline-sql.ts:14`, change `const EXISTS_PROJECT` to `export const EXISTS_PROJECT`. Replace `src/shared/entities/customers/lib/signed-customer-sql.ts` with:

```ts
import { sql } from 'drizzle-orm'

import { EXISTS_PROJECT } from './derived-pipeline-sql'

/**
 * "Signed" here is the pipeline's has-a-project bucket, not a sale: analytics
 * counts sales from approved proposals, and a project can be created without one.
 */
export function isSignedCustomerSql() {
  return sql<boolean>`${EXISTS_PROJECT}`
}
```

- [ ] **Step 7: Gates**

Run: `pnpm exec eslint --fix <the seven files> && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-analytics-rules.ts`
Expected: all clean; the verify script still passes (it imports none of these runtime modules).

- [ ] **Step 8: Read-only smoke against the dev DB (throwaway, not committed)**

Create `scripts/zz-analytics-smoke.ts`:

```ts
import './lib/load-env'
import assert from 'node:assert/strict'

import { loadAnalyticsFacts } from '@/features/analytics/dal/server/load-analytics-facts'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'

async function main() {
  const facts = dalVerifySuccess(await loadAnalyticsFacts())
  const stamps = [
    ...facts.customers.map(c => c.createdAt),
    ...facts.meetings.map(m => m.scheduledFor),
    ...facts.sales.flatMap(s => (s.approvedAt ? [s.approvedAt] : [])),
  ]
  assert.ok(stamps.every(s => s.endsWith('Z')), 'every timestamp is ISO')
  console.log({ customers: facts.customers.length, meetings: facts.meetings.length, sales: facts.sales.length, withClosers: facts.meetings.filter(m => m.closerIds.length > 0).length })
  process.exit(0)
}

main()
```

Run: `pnpm tsx scripts/zz-analytics-smoke.ts` (dev DB). If it fails with a `server-only` import error, rerun as `pnpm tsx --conditions=react-server scripts/zz-analytics-smoke.ts`.
Expected: prints non-zero counts, no assertion failure. Then `rm scripts/zz-analytics-smoke.ts` — never commit it.

- [ ] **Step 9: Commit**

```bash
git add src/shared/entities/customers/dal/server/analytics-facts.ts src/shared/entities/meetings/dal/server/analytics-facts.ts src/shared/modules/proposals/core/dal/server/analytics-facts.ts src/features/analytics/types.ts src/features/analytics/dal/server/load-analytics-facts.ts src/shared/entities/customers/lib/derived-pipeline-sql.ts src/shared/entities/customers/lib/signed-customer-sql.ts
git commit -m "feat(analytics): read-only analytics fact loaders; one EXISTS_PROJECT

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Composition rules and the per-person record

**Files:**
- Modify: `src/features/analytics/types.ts` (append)
- Create: `src/features/analytics/lib/analytics-rules.ts`
- Create: `src/features/analytics/lib/build-lead-records.ts`
- Modify: `scripts/verify-analytics-rules.ts`

**Interfaces:**
- Consumes: `AnalyticsFacts`, `CustomerFact`, `MeetingFact`, `SaleFact` (Task 5); `MEETING_OUTCOME_SIT`, `isProjectMeeting`, `MeetingSit` (Task 2); `groupDuplicatePeople`, `compareRecordAge` (Task 3); `classifySale`, `SaleKind` (Task 4).
- Produces (types, in `types.ts`):
  ```ts
  type MeetingOrder = 'first' | 'repeat' | 'not_sat' | 'project'
  interface LeadMeeting { id: string, at: string, outcome: MeetingOutcome, sit: MeetingSit, project: boolean, order: MeetingOrder, unresolved: boolean, closerIds: string[] }
  interface LeadSale { proposalId: string, meetingId: string, kind: SaleKind, at: string | null, valueCents: number | null, closerIds: string[], hasProject: boolean }
  interface BookedLead { at: string, meetingId: string, sat: boolean }
  interface LeadAnchor { leadAt: string, leadSourceId: string | null, city: string | null, zip: string | null }
  interface LeadRecord extends LeadAnchor { personId: string, customerIds: string[], quality: 'unknown', meetings: LeadMeeting[], bookedLead: BookedLead | null, sales: LeadSale[] }
  interface LeadRecordSet { leads: LeadRecord[], orphans: number }
  ```
- Produces (functions): `UNKNOWN_PLACE_VALUES: readonly string[]`; `toKnownPlace(value: string): string | null`; `pickLeadAnchor(records: readonly CustomerFact[]): LeadAnchor`; `deriveMeetingOrder(chronological: readonly { project: boolean, sit: MeetingSit }[]): MeetingOrder[]`; `pickBookedLead(chronological: readonly { id: string, at: string, project: boolean, sit: MeetingSit }[]): BookedLead | null`; `buildLeadRecords(facts: AnalyticsFacts, now: Date): LeadRecordSet`.

- [ ] **Step 1: Add the failing checks**

Add imports (type imports go with the other type imports at the top):

```ts
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'
import type { SaleFact } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
```

Add these fixture factories right after the imports (before section 1); Task 7 reuses them:

```ts
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
```

Insert after `1. Grouping`:

```ts
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
```

Insert after `4. Project meeting`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `@/features/analytics/lib/build-lead-records`.

- [ ] **Step 3: Append the record types to `src/features/analytics/types.ts`**

Add to its imports:

```ts
import type { MeetingOutcome, MeetingSit } from '@/shared/constants/enums/meetings'
import type { SaleKind } from '@/shared/modules/proposals/core/lib/sale'
```

Append:

```ts
export type MeetingOrder = 'first' | 'repeat' | 'not_sat' | 'project'

export interface LeadMeeting {
  id: string
  at: string
  outcome: MeetingOutcome
  sit: MeetingSit
  project: boolean
  order: MeetingOrder
  unresolved: boolean
  closerIds: string[]
}

export interface LeadSale {
  proposalId: string
  meetingId: string
  kind: SaleKind
  at: string | null
  valueCents: number | null
  closerIds: string[]
  hasProject: boolean
}

export interface BookedLead {
  at: string
  meetingId: string
  sat: boolean
}

export interface LeadAnchor {
  leadAt: string
  leadSourceId: string | null
  city: string | null
  zip: string | null
}

export interface LeadRecord extends LeadAnchor {
  personId: string
  customerIds: string[]
  quality: 'unknown'
  meetings: LeadMeeting[]
  bookedLead: BookedLead | null
  sales: LeadSale[]
}

export interface LeadRecordSet {
  leads: LeadRecord[]
  orphans: number
}
```

- [ ] **Step 4: Create `src/features/analytics/lib/analytics-rules.ts`**

```ts
import type { BookedLead, MeetingOrder, LeadAnchor } from '@/features/analytics/types'
import type { MeetingSit } from '@/shared/constants/enums/meetings'
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'

import { compareRecordAge } from '@/shared/entities/customers/lib/group-duplicate-people'

/** Website intake writes these placeholders when a lead gives no address. */
export const UNKNOWN_PLACE_VALUES: readonly string[] = ['Unknown', '']

export function toKnownPlace(value: string): string | null {
  const trimmed = value.trim()
  return UNKNOWN_PLACE_VALUES.includes(trimmed) ? null : trimmed
}

/** A lead is credited to the person's first contact with us; a later duplicate record never re-credits it. */
export function pickLeadAnchor(records: readonly CustomerFact[]): LeadAnchor {
  const earliest = [...records].sort(compareRecordAge)[0]
  return {
    leadAt: earliest.createdAt,
    leadSourceId: earliest.leadSourceId,
    city: toKnownPlace(earliest.city),
    zip: toKnownPlace(earliest.zip),
  }
}

/**
 * `first` is the first real sit: a cancelled or no-show meeting before it (a
 * reschedule's original) is noise, not the first visit. Expects oldest first.
 */
export function deriveMeetingOrder(chronological: readonly { project: boolean, sit: MeetingSit }[]): MeetingOrder[] {
  const firstSitIndex = chronological.findIndex(m => !m.project && m.sit === 'sat')
  return chronological.map((m, index) => {
    if (m.project) {
      return 'project'
    }
    if (index === firstSitIndex) {
      return 'first'
    }
    return firstSitIndex !== -1 && index > firstSitIndex ? 'repeat' : 'not_sat'
  })
}

/**
 * A customer is booked once, however many times they reschedule; the booking
 * lands on the sit when there was one, so sits can never exceed booked leads.
 * Expects oldest first.
 */
export function pickBookedLead(chronological: readonly { id: string, at: string, project: boolean, sit: MeetingSit }[]): BookedLead | null {
  const leadMeetings = chronological.filter(m => !m.project)
  const firstSit = leadMeetings.find(m => m.sit === 'sat')
  const picked = firstSit ?? leadMeetings[0]
  return picked ? { at: picked.at, meetingId: picked.id, sat: picked === firstSit } : null
}
```

- [ ] **Step 5: Create `src/features/analytics/lib/build-lead-records.ts`**

```ts
import type { AnalyticsFacts, LeadRecordSet, LeadRecord, LeadMeeting, LeadSale } from '@/features/analytics/types'
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'

import { deriveMeetingOrder, pickBookedLead, pickLeadAnchor } from '@/features/analytics/lib/analytics-rules'
import { isProjectMeeting, MEETING_OUTCOME_SIT } from '@/shared/constants/enums/meetings'
import { compareRecordAge, groupDuplicatePeople } from '@/shared/entities/customers/lib/group-duplicate-people'
import { classifySale } from '@/shared/modules/proposals/core/lib/sale'

function pushTo<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key) ?? []
  list.push(value)
  map.set(key, list)
}

export function buildLeadRecords(facts: AnalyticsFacts, now: Date): LeadRecordSet {
  const personOf = groupDuplicatePeople(facts.customers)
  let orphans = 0

  const recordsByPerson = new Map<string, CustomerFact[]>()
  for (const record of facts.customers) {
    pushTo(recordsByPerson, personOf.get(record.id)!, record)
  }

  const meetingById = new Map(facts.meetings.map(m => [m.id, m]))
  const meetingsByPerson = new Map<string, MeetingFact[]>()
  for (const m of facts.meetings) {
    const personId = m.customerId ? personOf.get(m.customerId) : undefined
    if (!personId) {
      orphans++
      continue
    }
    pushTo(meetingsByPerson, personId, m)
  }

  const salesByPerson = new Map<string, LeadSale[]>()
  for (const s of facts.sales) {
    const saleMeeting = s.meetingId ? meetingById.get(s.meetingId) : undefined
    const personId = saleMeeting?.customerId ? personOf.get(saleMeeting.customerId) : undefined
    if (!saleMeeting || !personId) {
      orphans++
      continue
    }
    pushTo(salesByPerson, personId, {
      proposalId: s.id,
      meetingId: saleMeeting.id,
      ...classifySale(s),
      closerIds: saleMeeting.closerIds,
      hasProject: saleMeeting.projectId !== null,
    })
  }

  const nowMs = now.getTime()
  const leads: LeadRecord[] = [...recordsByPerson].map(([personId, records]) => {
    const chronological = (meetingsByPerson.get(personId) ?? [])
      .map(m => ({
        id: m.id,
        at: m.scheduledFor,
        outcome: m.meetingOutcome,
        sit: MEETING_OUTCOME_SIT[m.meetingOutcome],
        project: isProjectMeeting(m),
        closerIds: m.closerIds,
      }))
      .sort((a, b) => compareRecordAge({ id: a.id, createdAt: a.at }, { id: b.id, createdAt: b.at }))
    const orders = deriveMeetingOrder(chronological)
    const meetings: LeadMeeting[] = chronological.map((m, index) => ({
      ...m,
      order: orders[index],
      unresolved: m.sit === 'unknown' && Date.parse(m.at) < nowMs,
    }))
    return {
      personId,
      customerIds: records.map(r => r.id),
      ...pickLeadAnchor(records),
      quality: 'unknown',
      meetings,
      bookedLead: pickBookedLead(meetings),
      sales: salesByPerson.get(personId) ?? [],
    }
  })

  return { leads, orphans }
}
```

(Meetings reuse `compareRecordAge` with `scheduledFor` as the time, so they get the same time-then-id ordering as records.)

- [ ] **Step 6: Run the check and gates**

Run: `pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: sections 1–8 and 10 print `✓`, then `✅ …`; tsc and lint clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/analytics/types.ts src/features/analytics/lib/analytics-rules.ts src/features/analytics/lib/build-lead-records.ts scripts/verify-analytics-rules.ts
git commit -m "feat(analytics): per-person lead records and composition rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The aggregator

**Files:**
- Modify: `src/features/analytics/types.ts` (append)
- Modify: `src/features/analytics/lib/analytics-rules.ts` (append)
- Create: `src/features/analytics/lib/aggregate-lead-records.ts`
- Modify: `scripts/verify-analytics-rules.ts`

**Interfaces:**
- Consumes: `LeadRecordSet`, `LeadRecord`, `LeadMeeting`, `MeetingOrder` (Task 6); `businessMonthKey` (Task 1); `MeetingOutcome`.
- Produces (types, in `types.ts`):
  ```ts
  interface AnalyticsFilters { range?: { from: string, to: string }, leadSourceIds?: (string | null)[], cities?: (string | null)[], zips?: (string | null)[], closerIds?: string[], outcomes?: MeetingOutcome[], meetingOrder?: MeetingOrder[] }
  type AnalyticsGroupBy = 'total' | 'leadSource' | 'month' | 'closer' | 'outcome' | 'meetingOrder' | 'city' | 'zip'
  interface AnalyticsRowHygiene { unresolvedMeetings: number, salesWithoutValue: number | null, newSalesWithoutProject: number | null, unknownCityZip: number | null }
  interface AnalyticsCounts { groupKey: string | null, overlapsTotal: boolean, totalLeads: number | null, validLeads: number | null, junkLeads: null, bookedLeads: number, sits: number, meetings: number, newSales: number | null, totalCloses: number | null, revenueNewCents: number | null, revenueUpsellCents: number | null, averageTicketCents: number | null, rates: Record<AnalyticsRateKey, number | null>, hygiene: AnalyticsRowHygiene }
  interface AnalyticsResult { rows: AnalyticsCounts[], undatedSales: number | null, orphans: number }
  ```
- Produces (rules, in `analytics-rules.ts`): `ANALYTICS_RATES`, `type AnalyticsRateKey`, `computeRate(numerator: number | null, denominator: number | null): number | null`.
- Produces: `aggregateLeadRecords(records: LeadRecordSet, filters: AnalyticsFilters, groupBy: AnalyticsGroupBy): AnalyticsResult`.

Semantics this task implements (spec §5, C36, C40, C41):
- `range` absent = all time; present = `[from, to)` on each stage's own date (leads `leadAt`, booked leads and sits `bookedLead.at`, meeting rows `at`, sales `at`). With a range, undated sales count only in `undatedSales`; without one they count everywhere and sit in the `null` month bucket.
- Person-level filters (`leadSourceIds`, `cities`, `zips`, `null` = unknown) drop people for every stage.
- Leads are **not applicable** (`null`) when any event-level filter is set or `groupBy` is `closer` / `outcome` / `meetingOrder`. Sales (and their hygiene) are **not applicable** when `outcomes` or `meetingOrder` is filtered or `groupBy` is `outcome` / `meetingOrder`; a closer filter or grouping applies to the sale meeting's closers.
- Booked leads and sits are tested against the booked lead's own meeting. `meetings` counts every meeting row, project or not.
- `groupBy: 'total'` always returns exactly one row (`groupKey: 'total'`), even with no data.
- Rows are sorted by `groupKey`, `null` last.

- [ ] **Step 1: Add the failing checks**

Add imports:

```ts
import { aggregateLeadRecords } from '@/features/analytics/lib/aggregate-lead-records'
```

Insert after `8. Sales (classification)`:

```ts
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
}
console.log('9. Aggregation ✓')
```

(The script already imports `businessMonthWindow` from Task 1.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `@/features/analytics/lib/aggregate-lead-records`.

- [ ] **Step 3: Append the rate rules to `src/features/analytics/lib/analytics-rules.ts`**

```ts
/**
 * Stage-to-stage rates over the same period. Close rate uses new sales only:
 * an upsell never came through a new-lead sit.
 */
export const ANALYTICS_RATES = {
  bookingRate: { numerator: 'bookedLeads', denominator: 'validLeads' },
  sitRate: { numerator: 'sits', denominator: 'bookedLeads' },
  closeRate: { numerator: 'newSales', denominator: 'sits' },
} as const

export type AnalyticsRateKey = keyof typeof ANALYTICS_RATES

export function computeRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null
  }
  return numerator / denominator
}
```

- [ ] **Step 4: Append the aggregate types to `src/features/analytics/types.ts`**

Add to its imports `import type { AnalyticsRateKey } from '@/features/analytics/lib/analytics-rules'` (type-only, so no runtime cycle; `MeetingOutcome` is already imported from Task 6). Append:

```ts
export interface AnalyticsFilters {
  range?: { from: string, to: string }
  leadSourceIds?: (string | null)[]
  cities?: (string | null)[]
  zips?: (string | null)[]
  closerIds?: string[]
  outcomes?: MeetingOutcome[]
  meetingOrder?: MeetingOrder[]
}

export type AnalyticsGroupBy = 'total' | 'leadSource' | 'month' | 'closer' | 'outcome' | 'meetingOrder' | 'city' | 'zip'

export interface AnalyticsRowHygiene {
  unresolvedMeetings: number
  salesWithoutValue: number | null
  newSalesWithoutProject: number | null
  unknownCityZip: number | null
}

export interface AnalyticsCounts {
  groupKey: string | null
  overlapsTotal: boolean
  totalLeads: number | null
  validLeads: number | null
  junkLeads: null
  bookedLeads: number
  sits: number
  meetings: number
  newSales: number | null
  totalCloses: number | null
  revenueNewCents: number | null
  revenueUpsellCents: number | null
  averageTicketCents: number | null
  rates: Record<AnalyticsRateKey, number | null>
  hygiene: AnalyticsRowHygiene
}

export interface AnalyticsResult {
  rows: AnalyticsCounts[]
  undatedSales: number | null
  orphans: number
}
```

- [ ] **Step 5: Create `src/features/analytics/lib/aggregate-lead-records.ts`**

```ts
import type { AnalyticsRateKey } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsCounts, AnalyticsFilters, AnalyticsGroupBy, LeadRecordSet, AnalyticsResult, MeetingOrder, LeadRecord, LeadMeeting, LeadSale } from '@/features/analytics/types'
import type { MeetingOutcome } from '@/shared/constants/enums/meetings'

import { computeRate, ANALYTICS_RATES } from '@/features/analytics/lib/analytics-rules'
import { businessMonthKey } from '@/shared/lib/business-time'

interface EventDimensions {
  at: string | null
  closerIds?: string[]
  outcome?: MeetingOutcome
  order?: MeetingOrder
}

interface Tally {
  leads: number
  unknownCityZip: number
  bookedLeads: number
  sits: number
  meetings: number
  unresolvedMeetings: number
  newSales: number
  totalCloses: number
  revenueNewCents: number
  revenueUpsellCents: number
  newSalesWithValue: number
  salesWithoutValue: number
  newSalesWithoutProject: number
}

function emptyTally(): Tally {
  return { leads: 0, unknownCityZip: 0, bookedLeads: 0, sits: 0, meetings: 0, unresolvedMeetings: 0, newSales: 0, totalCloses: 0, revenueNewCents: 0, revenueUpsellCents: 0, newSalesWithValue: 0, salesWithoutValue: 0, newSalesWithoutProject: 0 }
}

function matches<T>(allowed: readonly T[] | undefined, value: T): boolean {
  return !allowed?.length || allowed.includes(value)
}

function groupKeys(groupBy: AnalyticsGroupBy, person: LeadRecord, event: EventDimensions): (string | null)[] {
  switch (groupBy) {
    case 'total':
      return ['total']
    case 'leadSource':
      return [person.leadSourceId]
    case 'city':
      return [person.city]
    case 'zip':
      return [person.zip]
    case 'month':
      return [event.at === null ? null : businessMonthKey(event.at)]
    case 'closer':
      return event.closerIds ?? []
    case 'outcome':
      return event.outcome ? [event.outcome] : []
    case 'meetingOrder':
      return event.order ? [event.order] : []
  }
}

export function aggregateLeadRecords(records: LeadRecordSet, filters: AnalyticsFilters, groupBy: AnalyticsGroupBy): AnalyticsResult {
  const meetingFiltered = !!(filters.outcomes?.length || filters.meetingOrder?.length)
  const eventFiltered = meetingFiltered || !!filters.closerIds?.length
  const leadsApplicable = !eventFiltered && groupBy !== 'closer' && groupBy !== 'outcome' && groupBy !== 'meetingOrder'
  const salesApplicable = !meetingFiltered && groupBy !== 'outcome' && groupBy !== 'meetingOrder'

  const fromMs = filters.range ? Date.parse(filters.range.from) : null
  const toMs = filters.range ? Date.parse(filters.range.to) : null
  const inRange = (at: string | null): boolean => {
    if (fromMs === null || toMs === null) {
      return true
    }
    if (at === null) {
      return false
    }
    const ms = Date.parse(at)
    return ms >= fromMs && ms < toMs
  }

  const meetingPasses = (m: LeadMeeting) =>
    (!filters.closerIds?.length || m.closerIds.some(id => filters.closerIds!.includes(id)))
    && matches(filters.outcomes, m.outcome)
    && matches(filters.meetingOrder, m.order)
  const salePasses = (s: LeadSale) =>
    !filters.closerIds?.length || s.closerIds.some(id => filters.closerIds!.includes(id))

  const tallies = new Map<string | null, Tally>()
  const tallyFor = (key: string | null) => {
    const tally = tallies.get(key) ?? emptyTally()
    tallies.set(key, tally)
    return tally
  }
  if (groupBy === 'total') {
    tallyFor('total')
  }

  let undatedSales = 0
  const leads = records.leads.filter(p =>
    matches(filters.leadSourceIds, p.leadSourceId) && matches(filters.cities, p.city) && matches(filters.zips, p.zip))

  for (const person of leads) {
    if (leadsApplicable && inRange(person.leadAt)) {
      for (const key of groupKeys(groupBy, person, { at: person.leadAt })) {
        const tally = tallyFor(key)
        tally.leads++
        if (person.city === null || person.zip === null) {
          tally.unknownCityZip++
        }
      }
    }

    const booked = person.bookedLead
    const bookedMeeting = booked && person.meetings.find(m => m.id === booked.meetingId)
    if (booked && bookedMeeting && inRange(booked.at) && meetingPasses(bookedMeeting)) {
      for (const key of groupKeys(groupBy, person, { at: booked.at, closerIds: bookedMeeting.closerIds, outcome: bookedMeeting.outcome, order: bookedMeeting.order })) {
        const tally = tallyFor(key)
        tally.bookedLeads++
        if (booked.sat) {
          tally.sits++
        }
      }
    }

    for (const m of person.meetings) {
      if (!inRange(m.at) || !meetingPasses(m)) {
        continue
      }
      for (const key of groupKeys(groupBy, person, { at: m.at, closerIds: m.closerIds, outcome: m.outcome, order: m.order })) {
        const tally = tallyFor(key)
        tally.meetings++
        if (m.unresolved) {
          tally.unresolvedMeetings++
        }
      }
    }

    if (!salesApplicable) {
      continue
    }
    for (const s of person.sales) {
      if (!salePasses(s)) {
        continue
      }
      if (s.at === null) {
        undatedSales++
      }
      if (!inRange(s.at)) {
        continue
      }
      for (const key of groupKeys(groupBy, person, { at: s.at, closerIds: s.closerIds })) {
        const tally = tallyFor(key)
        tally.totalCloses++
        if (s.kind === 'new') {
          tally.newSales++
          if (!s.hasProject) {
            tally.newSalesWithoutProject++
          }
        }
        if (s.valueCents === null) {
          tally.salesWithoutValue++
        }
        else if (s.kind === 'new') {
          tally.revenueNewCents += s.valueCents
          tally.newSalesWithValue++
        }
        else {
          tally.revenueUpsellCents += s.valueCents
        }
      }
    }
  }

  const rows: AnalyticsCounts[] = [...tallies].map(([groupKey, t]) => {
    const leads = leadsApplicable ? t.leads : null
    const newSales = salesApplicable ? t.newSales : null
    const stages = { validLeads: leads, bookedLeads: t.bookedLeads, sits: t.sits, newSales }
    const rates = {} as Record<AnalyticsRateKey, number | null>
    for (const rateKey of Object.keys(ANALYTICS_RATES) as AnalyticsRateKey[]) {
      const { numerator, denominator } = ANALYTICS_RATES[rateKey]
      rates[rateKey] = computeRate(stages[numerator], stages[denominator])
    }
    return {
      groupKey,
      overlapsTotal: groupBy === 'closer',
      totalLeads: leads,
      validLeads: leads,
      junkLeads: null,
      bookedLeads: t.bookedLeads,
      sits: t.sits,
      meetings: t.meetings,
      newSales,
      totalCloses: salesApplicable ? t.totalCloses : null,
      revenueNewCents: salesApplicable ? t.revenueNewCents : null,
      revenueUpsellCents: salesApplicable ? t.revenueUpsellCents : null,
      averageTicketCents: salesApplicable && t.newSalesWithValue > 0 ? Math.round(t.revenueNewCents / t.newSalesWithValue) : null,
      rates,
      hygiene: {
        unresolvedMeetings: t.unresolvedMeetings,
        salesWithoutValue: salesApplicable ? t.salesWithoutValue : null,
        newSalesWithoutProject: salesApplicable ? t.newSalesWithoutProject : null,
        unknownCityZip: leadsApplicable ? t.unknownCityZip : null,
      },
    }
  })

  rows.sort((a, b) => {
    if (a.groupKey === b.groupKey) {
      return 0
    }
    if (a.groupKey === null) {
      return 1
    }
    if (b.groupKey === null) {
      return -1
    }
    return a.groupKey < b.groupKey ? -1 : 1
  })

  return { rows, undatedSales: salesApplicable ? undatedSales : null, orphans: records.orphans }
}
```

- [ ] **Step 6: Run the check and gates**

Run: `pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: sections 1–10 all `✓`, then `✅ verify-analytics-rules passed`; tsc and lint clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/analytics/types.ts src/features/analytics/lib/analytics-rules.ts src/features/analytics/lib/aggregate-lead-records.ts scripts/verify-analytics-rules.ts
git commit -m "feat(analytics): lead-record aggregator with person and event dimensions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Rule index, prod sanity run, tracker

**Files:**
- Modify: `CONTEXT.md` (new `## Analytics terms` section after `## Funnel terms`)
- Modify: `docs/plans/2026-09-26-analytics-epic.md` (§0 row A, §3 A1–A9, §7 tally)

- [ ] **Step 1: Add `## Analytics terms` to `CONTEXT.md`** (insert before `## Presentation terms`)

```markdown
## Analytics terms

Each business rule behind an analytics number is one named export; change the rule there, then run `pnpm tsx scripts/verify-analytics-rules.ts`. "Meeting" stays the row; "appointment" stays avoided.

| Term | Rule | Defined in |
|---|---|---|
| **Lead** | One person, for life. Dated by, and credited to the source of, the person's earliest record | `pickLeadAnchor` · `src/features/analytics/lib/analytics-rules.ts` |
| **Same person** | Same normalized phone OR email, matches chained | `groupDuplicatePeople` · `src/shared/entities/customers/lib/group-duplicate-people.ts` |
| **Total leads / valid leads** | All leads / leads minus junk. Test leads are in neither | `aggregateLeadRecords` · `src/features/analytics/lib/aggregate-lead-records.ts` |
| **Junk lead / test lead** | Lead quality flags (not built yet) | `LeadRecord.quality` |
| **Sit** | The rep physically met the homeowner | `MEETING_OUTCOME_SIT`, `isSit` · `src/shared/constants/enums/meetings.ts` |
| **Project meeting** | The stored `Project` meeting type: serves an existing project (visits, upsells). Every other meeting works a lead toward its sale | `isProjectMeeting` · `src/shared/constants/enums/meetings.ts` |
| **Booked lead** | A lead with at least one non-project meeting, counted once; dated at the first sit, else the first non-project meeting | `pickBookedLead` · `src/features/analytics/lib/analytics-rules.ts` |
| **Meeting order** | `first` = first sat non-project meeting · `repeat` = after it · `not_sat` = before it, or never sat · `project` = a project meeting | `deriveMeetingOrder` · `src/features/analytics/lib/analytics-rules.ts` |
| **Unresolved meeting** | A past meeting with no outcome recorded (`not_set`) — unknown, never a sit, surfaced for fixing | `isUnresolvedMeeting` · `src/features/analytics/lib/analytics-rules.ts` |
| **New sale / total closes / revenue** | An approved proposal, dated at `approvedAt` (no fallback); initial sale = new, additional work = upsell | `classifySale`, `SALE_STATUS` · `src/shared/modules/proposals/core/lib/sale.ts` |
| **Rates** | Booking, sit and close rate over the same period; a total is Σ÷Σ | `ANALYTICS_RATES` · `src/features/analytics/lib/analytics-rules.ts` |
| **Unknown city / zip** | Website-intake placeholders count as unknown | `UNKNOWN_PLACE_VALUES` · `src/features/analytics/lib/analytics-rules.ts` |
| **Bankable** | A project's money is net, at risk (on hold) or cancelled | `projectBankability` · `src/shared/modules/projects/core/lib/bankability.ts` |
| **Closer** | Any participant of the meeting; per-closer totals overlap by design | `MeetingFact.closerIds` · `src/shared/entities/meetings/dal/server/analytics-facts.ts` |
| **Business month** | Calendar month in Pacific time, never UTC | `businessMonthKey`, `businessMonthWindow` · `src/shared/lib/business-time.ts` |
| **Funnel** | The marketing funnels only (see Funnel terms) — the analytics chain is the lead chain | — |
```

- [ ] **Step 2: Read-only sanity run against prod (throwaway, not committed)**

Create `scripts/zz-analytics-sanity.ts`:

```ts
import './lib/load-env'

import { aggregateLeadRecords } from '@/features/analytics/lib/aggregate-lead-records'
import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
import { loadAnalyticsFacts } from '@/features/analytics/dal/server/load-analytics-facts'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'

async function main() {
  const facts = dalVerifySuccess(await loadAnalyticsFacts())
  const records = buildLeadRecords(facts, new Date())
  const result = aggregateLeadRecords(records, {}, 'total')
  console.log({ customers: facts.customers.length, leads: records.leads.length, orphans: records.orphans })
  console.log(result.rows[0], { undatedSales: result.undatedSales })
  process.exit(0)
}

main()
```

Run: `DRIZZLE_TARGET=prod pnpm tsx scripts/zz-analytics-sanity.ts` (add `--conditions=react-server` if Task 5 needed it). It is `SELECT`-only.
Expected, compared by hand with the tracker's §7 tally (prod, 2026-09-26): `customers` ≈ 767 and `leads` ≤ customers; `orphans` 0; all-time `newSales + upsells = totalCloses` with total closes ≈ 39 approved proposals; `hygiene.unresolvedMeetings` ≈ 27 (H2); `hygiene.unknownCityZip` ≈ 39 (H3, counted per person so it may be lower); `hygiene.newSalesWithoutProject` ≈ 0 (H4); run once more with `{ range: businessMonthWindow('<current month>') }` and check `undatedSales` = 5 (H1). Paste the printed numbers into the tracker §7 "Last read" note. Any mismatch beyond duplicate-merging: stop and report it — do not adjust a rule to fit. Then `rm scripts/zz-analytics-sanity.ts`.

- [ ] **Step 3: Update the tracker `docs/plans/2026-09-26-analytics-epic.md`**

- §3: tick `A1`–`A9` (`[x]`), with A1 noting "cancelled / net are wired by B through `projectBankability`; junk / test by C through `LeadRecord.quality`".
- §0 row A: Plan = `docs/superpowers/plans/2026-09-26-analytics-a-lead-rules.md`, Status = `[x] shipped <first-sha>..<last-sha>`.
- Status line: Spec A shipped; F unblocked.
- §7: refresh counts and the "Last read" date from Step 2.

- [ ] **Step 4: Gates and commit**

Run: `pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: all clean.

```bash
git add CONTEXT.md docs/plans/2026-09-26-analytics-epic.md
git commit -m "docs(analytics): analytics terms rule index; Spec A shipped

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
