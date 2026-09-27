# Analytics Spec A — Funnel rules + person identity

> **Tracker:** `docs/plans/2026-09-26-analytics-epic.md` (the source of truth). This spec owns **A1–A9**. It cites decisions by ID (C1–C41) and does not restate them. If this spec and the tracker disagree, the tracker wins.
> **Baseline:** `main` at `e8c5d97a`; re-verified against `7e5cc00e` on 2026-09-26 (the commits in between touch only calculators). Prod counts read 2026-09-26 (read-only): 767 customers, 285 meetings, 114 proposals (39 approved), 66 projects (42 portfolio-only).
> **Ships:** named rule exports, read-only fact loaders, the per-person funnel record, one aggregator, a verify script, and the CONTEXT.md rule index. **No UI, no router, no schema change.**

## 1. Goal

Every analytics number comes from one chain: **fact loaders → person grouping → per-person record → aggregator**. Each rule is defined once, in the entity or module that owns its table (C29), as one named export that can be tweaked in place (C38). Spec F renders the aggregator's output. Spec B wires the projects stat bar to the bankability classifier. Specs C, D and E fill slots this spec leaves marked "not available yet" (F11).

## 2. Rule index (C28, C38)

This table becomes CONTEXT.md's `## Analytics terms` section (A9) — the one place to look a rule up. The symbol is the one place to change it.

| Term | Rule | Symbol · file |
|---|---|---|
| **Lead** | One person, for life (C2). Dated by, and credited to the source of, the person's earliest record (C14) | `pickPersonAnchor` · `features/analytics/lib/funnel-rules.ts` |
| **Same person** | Same normalized phone OR email, chained (C3) | `groupDuplicatePeople` · `entities/customers/lib/group-duplicate-people.ts` |
| **Total leads / valid leads** | All leads / leads minus junk (C12). Test leads are in neither | `aggregateFunnel` → `totalLeads`, `validLeads` |
| **Junk lead / test lead** | Quality flags (Spec C) | `PersonFunnel.quality` |
| **Sit** | The rep physically met the homeowner (C4) | `MEETING_OUTCOME_SIT`, `isSit` · `constants/enums/meetings.ts` |
| **Funnel meeting** | Not `Project` type, not `additional_work` (C4) | `isFunnelMeeting` · `constants/enums/meetings.ts` |
| **Booked lead** | A lead with at least one funnel meeting, counted once; dated at the first sit, else the first funnel meeting (C8, C9, C31). "Meeting" stays the row; "appointment" stays avoided (`docs/ubiquitous-language.md:261`) | `pickBookedLead` · `funnel-rules.ts` |
| **Meeting order** | `first` · `repeat` · `not_sat` · `project` (C37) | `deriveMeetingOrder` · `funnel-rules.ts` |
| **New sale / total closes / revenue** | Approved proposal, dated at `approvedAt`, split by `kind` (C6, C11, C32) | `classifySale`, `SALE_STATUS` · `modules/proposals/core/lib/sale.ts` |
| **Rates** | Booking, sit and close rates, same-period, Σ÷Σ (C36) | `FUNNEL_RATES` · `funnel-rules.ts` |
| **Unknown city / zip** | Website intake placeholders count as unknown | `UNKNOWN_CITY_VALUES` · `funnel-rules.ts` |
| **Bankable** | A project's money is net, at risk (`on_hold`) or cancelled (C15, C16) | `projectBankability` · `modules/projects/core/lib/bankability.ts` |
| **Closer** | Any participant of the meeting (C19, C33) | `MeetingFact.closerIds` |
| **Setter** | `meetings.createdBy` (Spec D). Not in this spec | — |
| **Total Opened** | The projects stat-bar name; kept (C28, B6 closed) | Spec B |

**Rule-keeping contract (C38):** each rule above is a named export with a one-line comment giving the business *why* (no plan or tracker citations in code). `buildPersonFunnel` and `aggregateFunnel` call these exports and contain no rule logic of their own. Changing a rule = editing its export, then running the verify script (§6), which has one numbered check per rule.

## 3. Where things live (C29)

| # | File | New / changed | Contents |
|---|---|---|---|
| 1 | `src/shared/constants/enums/meetings.ts` | changed | `MEETING_OUTCOME_SIT: Record<MeetingOutcome, 'sat' \| 'not_sat' \| 'unknown'>` (exhaustive, same pattern as `MEETING_OUTCOME_SENTIMENT`; `additional_work` → `sat`, C39); `isSit(outcome)`; `isFunnelMeeting({ meetingType, meetingOutcome })` |
| 2 | `src/shared/lib/email.ts` | new | `normalizeEmail(raw)`: trim and lower-case; empty → `null`. Sibling of `src/shared/lib/phone.ts`. Used at read time only; the email write path does not change here |
| 3 | `src/shared/lib/business-time.ts` | new (moved) | Moved from `src/features/agent-dashboard/lib/meeting-windows.ts`: `BUSINESS_TIMEZONE`, `businessDayKey`, `businessToday`, and the private helpers `utcOffsetMs`, `startOfDayInTimeZone`, `addCalendarDays` (exported now). New: `businessMonthKey(date) → 'YYYY-MM'` and `businessMonthWindow(monthKey) → { from, to }` (ISO) |
| 4 | `src/features/agent-dashboard/lib/meeting-windows.ts` | changed | Keeps `MeetingWindowKind`, `meetingWindow` and `meetingMonthWindow`, now built on `shared/lib/business-time`; `meetingMonthWindow` becomes `businessMonthWindow` of the anchor's month (one month-window implementation). `dashboard-meetings-calendar.tsx`, `dashboard-meetings-hub.tsx` and `app/(frontend)/dashboard/page.tsx` import `businessDayKey` / `businessToday` from `shared/lib/business-time`; `constants/dashboard-queries.ts` keeps importing `meetingWindow` / `meetingMonthWindow` from here. No behavior change. The six other inline `'America/Los_Angeles'` literals are out of scope |
| 5 | `src/shared/entities/customers/lib/group-duplicate-people.ts` | new | Pure union-find over `{ id, phone, email, createdAt }` (C3). Phone keys via `toNationalDigits` (`shared/lib/phone.ts`), email keys via `normalizeEmail`; a null key never matches. Returns `Map<customerId, personId>`, where `personId` is the id of the group's earliest record (ties broken by id) |
| 6 | `src/shared/modules/proposals/core/lib/sale.ts` | new | `SALE_STATUS = 'approved'`; `classifySale(row) → { kind: 'new' \| 'upsell', at: string \| null, valueCents: number \| null }` from the stored `kind`, `approvedAt`, `finalTcpCents` (C6, C11, C32) |
| 7 | `src/shared/modules/projects/core/lib/bankability.ts` | new | `projectBankability(stage) → 'net' \| 'at_risk' \| 'cancelled'`, derived through `deriveProjectStatusBucket` (never a second stage list). Spec B consumes it and deletes `NON_BANKABLE_PROJECT_STAGES` |
| 8 | `src/shared/entities/customers/dal/server/analytics-facts.ts` | new | `CustomerFact` type + `listCustomerFacts()`: every customer's `id, phone, email, createdAt, leadSourceId, city, zip` |
| 9 | `src/shared/entities/meetings/dal/server/analytics-facts.ts` | new | `MeetingFact` type + `listMeetingFacts()`: `id, customerId, meetingType, meetingOutcome, scheduledFor, projectId`, plus `closerIds` (participant user ids) through the existing `getAllParticipantsForMeetings` (`entities/meetings/dal/server/participants.ts:145`) |
| 10 | `src/shared/modules/proposals/core/dal/server/analytics-facts.ts` | new | `SaleFact` type + `listSaleFacts()`: proposals where `status = SALE_STATUS`, with `id, meetingId, kind, approvedAt, finalTcpCents` |
| 11 | `src/features/analytics/types.ts` | new | `PersonFunnel`, `PersonMeeting`, `PersonSale`, `MeetingOrder`, `FunnelFacts`, `FunnelFilters`, `FunnelGroupBy`, `FunnelCounts`. Fact row types are imported from their loaders (rows 8–10) — `shared/` never imports from a feature |
| 12 | `src/features/analytics/lib/funnel-rules.ts` | new | Analytics' own composition rules (C38): `pickPersonAnchor`, `pickBookedLead`, `deriveMeetingOrder`, `FUNNEL_RATES`, `UNKNOWN_CITY_VALUES` (§4, §5) |
| 13 | `src/features/analytics/lib/build-person-funnel.ts` | new | `buildPersonFunnel(facts, now) → PersonFunnel[]` (§4). Joins and orders; every decision is a call into rows 1, 5, 6 or 12 |
| 14 | `src/features/analytics/lib/aggregate-funnel.ts` | new | `aggregateFunnel(people, filters, groupBy) → FunnelCounts[]` (§5). The only file that turns records into numbers |
| 15 | `src/features/analytics/dal/server/load-funnel-facts.ts` | new | Calls the three loaders in parallel through `dalVerifySuccess`. The one entry point Spec F's router uses |
| 16 | `src/shared/entities/customers/lib/signed-customer-sql.ts` | changed | Reuses the `EXISTS_PROJECT` SQL exported from `derived-pipeline-sql.ts` (one copy). Its comment says this is the pipeline's "has a project" bucket, not a sale. No rename, no behavior change |
| 17 | `CONTEXT.md` | changed | New `## Analytics terms` section = §2's table |
| 18 | `scripts/verify-analytics-rules.ts` | new | §6 |

The fact loaders follow the `entities/customers/dal/server/ad-performance.ts` precedent: system-level reads, no ctx, `dalDbOperation`, rows out, no counting. Callers are super-admin-gated at the router (Spec F).

**No project loader in A.** A counts no projects: sales come from proposals, and "signed, no project" reads the sale meeting's `projectId`. A meeting-linked project is by definition not pure-portfolio, so A8 holds by construction. Spec B adds the project loader (with `hasAssociatedMeeting()`) when it needs stages.

## 4. The per-person record (C2, C3, C7, C8, C9, C31, C37)

```ts
type MeetingOrder = 'first' | 'repeat' | 'not_sat' | 'project'

interface PersonFunnel {
  personId: string
  customerIds: string[]
  leadSourceId: string | null   // earliest record's; null = unknown source (its own group)
  leadAt: string                // earliest record's createdAt
  city: string | null           // earliest record's; UNKNOWN_CITY_VALUES → null
  zip: string | null
  quality: 'unknown'            // widened by Spec C to 'valid' | 'junk' | 'test'
  meetings: PersonMeeting[]     // every meeting row of every record, oldest first
  bookedLead: { at: string, meetingId: string, sat: boolean } | null
  sales: PersonSale[]
}
interface PersonMeeting {
  id: string
  at: string                    // scheduledFor (C31)
  outcome: MeetingOutcome
  sit: 'sat' | 'not_sat' | 'unknown'
  funnel: boolean
  order: MeetingOrder           // C37
  unresolved: boolean           // sit === 'unknown' && at < now
  closerIds: string[]
}
interface PersonSale {
  proposalId: string
  meetingId: string
  kind: 'new' | 'upsell'
  at: string | null             // null = undated (C32)
  valueCents: number | null
  closerIds: string[]           // the sale meeting's participants
  hasProject: boolean           // the sale meeting's projectId is set
}
```

- **Grouping:** `groupDuplicatePeople` over customer facts; every meeting (by `customerId`) and sale (through its meeting) joins the person (A3).
- **Anchor (`pickPersonAnchor`):** the earliest record (by `createdAt`, ties by id) supplies `leadAt`, `leadSourceId`, `city`, `zip`.
- **Meetings are ordered** by `scheduledFor`, ties by id.
- **Booked lead (`pickBookedLead`):** the person's first sat funnel meeting, `sat: true`; else their earliest funnel meeting, `sat: false`; with no funnel meeting, `null`. Sits ≤ booked leads holds in every month.
- **Meeting order (`deriveMeetingOrder`, C37):** `project` for non-funnel meetings; `first` for the person's first sat funnel meeting; `repeat` for every funnel meeting after it, whatever its outcome; `not_sat` for every funnel meeting before it, or all of them when the person never sat. So a sat booked lead's meeting is always `first`; a non-sat booked lead's is always `not_sat`.
- A meeting with no `customerId`, or a sale whose meeting has none (or has no meeting), is dropped and counted in `hygiene.orphans` (0 in prod today).
- `now` is passed in, so the builder stays pure.

## 5. The aggregator (C5, C7, C11, C12, C19, C21, C36)

```ts
interface FunnelFilters {
  range: { from: string, to: string }        // ISO; month presets built with businessMonthWindow
  leadSourceIds?: (string | null)[]          // person-level; null = unknown source
  zips?: (string | null)[]                   // person-level; null = unknown
  cities?: (string | null)[]
  closerIds?: string[]                       // event-level
  outcomes?: MeetingOutcome[]                // event-level
  meetingOrder?: MeetingOrder[]              // event-level
}
type FunnelGroupBy = 'total' | 'leadSource' | 'month' | 'closer' | 'outcome' | 'meetingOrder' | 'city' | 'zip'
```

- **Person-level** filters choose which people are counted, for every stage.
- **Event-level** filters choose which meetings and sales are counted. `totalLeads` and `validLeads` then come back `null` ("not applicable") instead of an unfiltered number (C36).
- **Booked leads and sits under an event-level filter** (C41) are tested against the booked lead's own meeting (its closers, outcome and order). A sale is tested against its sale meeting (closers) — outcome and order filters leave sales `null` ("not applicable"), since a sale is not a meeting outcome.
- Each stage counts by its own event date inside `range` (C7): leads by `leadAt`, booked leads and sits by `bookedLead.at`, sales by `at`, meeting rows by `at`.

`FunnelCounts` (one per group):

| Field | Rule |
|---|---|
| `totalLeads` | people with `leadAt` in range (test leads excluded once C lands) |
| `validLeads` | = `totalLeads` until C; `junkLeads` is `null` ("not available yet") until then |
| `bookedLeads` / `sits` | `bookedLead.at` in range / and `sat` |
| `meetings` | every meeting row in range, funnel and project (C40); the base for outcome ratios, e.g. "share of `not_good` in July". Narrow with the `meetingOrder` filter |
| `newSales` / `totalCloses` | dated sales in range with kind `new` / any kind |
| `revenueNewCents` / `revenueUpsellCents` | Σ known `valueCents` per kind |
| `averageTicketCents` | `revenueNewCents` ÷ new sales with a value; `null` when there are none |
| rates | from `FUNNEL_RATES`: `bookingRate = bookedLeads/validLeads`, `sitRate = sits/bookedLeads`, `closeRate = newSales/sits`; `null` on a zero or `null` base. Same-period ratios (C7, C36), not cohort conversion. A total is always Σ÷Σ, never an average of per-group rates |
| `hygiene` | `unresolvedMeetings`, `undatedSales`, `salesWithoutValue`, `newSalesWithoutProject`, `unknownCityZip`, `orphans` |

**Closer grouping (C19, C33):** each meeting and each sale counts once toward each of its participants. Every per-closer row carries `overlapsTotal: true`, so the UI can say the per-closer rows add up to more than the total.

**Cancelled / net / at risk:** Spec B adds them to `FunnelCounts` through `projectBankability` and the cancellation date (Q6). Spec E adds spend and cost per stage.

## 6. Verification (C34, C38)

`scripts/verify-analytics-rules.ts`, run with `pnpm tsx scripts/verify-analytics-rules.ts`. Pure, no DB, no env. It follows the `scripts/verify-*.ts` shape: `/* eslint-disable no-console */`, a numbered `console.log` per check, `process.exit(1)` on the first failed assertion. One numbered check per §2 rule:

1. **Grouping:** A~B by phone, B~C by email ⇒ one person; household phone ⇒ one person; `1`-prefixed and formatted phones match their 10-digit form; case and whitespace email variants match; empty phone and email never match each other.
2. **Anchor:** person id, source, lead date and city/zip come from the earliest record; `'Unknown'` / `''` city ⇒ `null`; an earliest record with no source ⇒ `leadSourceId: null`.
3. **Sit map:** every `meetingOutcome` is classified. Spot checks: `nra` → not_sat, `not_set` → unknown, `follow_up_needed` → sat, `additional_work` → sat.
4. **Funnel meeting:** `Project`-type and `additional_work` meetings are not funnel meetings.
5. **Booked lead:** two cancelled meetings then a sit ⇒ 1 booked lead dated at the sit; a single cancelled meeting ⇒ 1 non-sit booked lead; non-funnel meetings never create one; sits ≤ booked leads across a mixed fixture.
6. **Meeting order:** cancelled → `pns` ⇒ `not_sat`, `first`; `pns` → `follow_up_needed` → `cancelled` ⇒ `first`, `repeat`, `repeat`; a person who never sat ⇒ all `not_sat`; a `Project` meeting ⇒ `project`.
7. **Pacific months:** `2026-08-01T05:30:00Z` (July 31, 22:30 PDT) ⇒ `2026-07`; DST-boundary month windows.
8. **Sales:** an undated sale counts in no month and in `hygiene.undatedSales`; a null value counts as a sale but not revenue; `additional-work` ⇒ `upsell`, which is in total closes but not new sales.
9. **Aggregation:** event-level filter ⇒ `totalLeads: null`; an outcome filter tests the booked lead's own meeting; per-closer rows sum above the total; rates are `null` on a zero base; the total rate is Σ÷Σ.
10. **Bankability:** every `projectPipelineStages` value maps; `on_hold` ⇒ `at_risk`.

Plus `pnpm tsc` and `pnpm lint`.

After the script passes, one read-only sanity run against prod through a throwaway `npx tsx` (not committed) prints all-time totals from `loadFunnelFacts` → `buildPersonFunnel` → `aggregateFunnel`, compared by hand with the tracker's §7 tally counts.

## 7. Out of scope

- Junk and test flags (C / N1–N4).
- Setter (D).
- Spend (E).
- Project facts, cancellation dating and stat-bar wiring (B).
- Every UI, router, nav or `lead-sources-admin` change (F).
- Whether to reuse the July engine (Q5, decided in F).
- Normalizing email on write, and deduplicating at intake.
- The six other inline time-zone literals.
- Manual data fixes: listed in the tracker's hygiene tally (§7 there). This spec never writes data.

## 8. Decided at review (2026-09-26)

- **C39:** `additional_work` → `sat` in `MEETING_OUTCOME_SIT`.
- **C40:** `meetings` counts every meeting row, funnel and project.
- **C41:** under an event-level filter, booked leads and sits are tested against the booked lead's own meeting; outcome / order filters make sales "not applicable".
