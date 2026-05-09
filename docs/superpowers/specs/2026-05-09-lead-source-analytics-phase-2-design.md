# Lead Source Analytics — Phase 2 Design

**Date:** 2026-05-09
**Branch:** `refactor/lead-sources-mobile-responsive` (continues from Phase 1)
**Author:** Brainstormed in chat; spec written and self-reviewed.
**Phase:** 2 of 3 (Phase 1 = shell + Customers + Settings; Phase 2 = funnel + trend; Phase 3 = funnel×time + cohort)

---

## Goals

Replace `LeadSourceAnalyticsPlaceholder` with two diagnostic visualizations:

1. **Funnel breakdown** — Lead → Meeting → Proposal → Signed, with drop-off rates between steps. Scoped to the active time-range chip.
2. **Trend chart** — 3-line trend (Leads / Meetings / Signatures) over the active range, with adaptive bucketing.

Both share one server round-trip and one chip prop drilled from `source-detail.tsx`.

## Non-goals

- Funnel × time table (Phase 3)
- Cohort table (Phase 3)
- Range-scoped `totalSales` (Phase 3)
- Cross-source comparison or aggregate analytics on the All pane

## User flow rationale

Brainstormed answers (Pass 1 of UI playbook):

1. **Who:** Super-admin during weekly health check.
2. **Context:** Monday-morning scan: "Which sources are converting? Which dropped? Where do I cut spend?"
3. **Top scenario:** "I noticed source X's signed count dropped this week — which step is leaking, and when did it start?"
4. **Most probable diagnostic anchor:** Trend over time. The funnel answers "where's the leak right now"; the trend answers "when did it start". Trend is the go-to for diagnosis.
5. **Life-easier affordances:** One range scope across the whole tab (no separate range pickers); tooltip with signed-rate; counts in tabular-nums.
6. **Eye lands first:** The Signed bar in the funnel (single primary-color moment) — that's the bottom-line outcome.

Layout decisions cite these scenarios.

## Architecture

### Server — one new procedure

**`leadSourcesRouter.getAnalytics({ id, from?, to? })`**

One procedure rather than two because both queries share the same `customersMatchingSource(id)` predicate + range filter. Splitting would duplicate the join.

**Input** (extends existing range-input pattern):
```ts
z.object({
  id: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
```

**Output:**
```ts
{
  funnel: {
    leads: number          // customers created in [from, to] matching this source
    meetingsBooked: number // ⊆ leads, with ≥1 meeting whose start_at ∈ [from, to]
    proposalsSent: number  // ⊆ leads, with ≥1 proposal whose status ∈ [sent, approved] AND created_at ∈ [from, to]
    signed: number         // ⊆ leads, matching isSignedCustomerSql AND project created_at ∈ [from, to]
  }
  trend: Array<{
    bucketStart: string    // ISO date — start of bucket
    leads: number          // distinct customers created in bucket
    meetings: number       // distinct customers with ≥1 meeting whose start_at ∈ bucket
    signed: number         // distinct customers who got their first project in bucket
  }>
  bucket: 'day' | 'week' | 'month'
}
```

**Bucket selection (server-side, deterministic):**
- Range ≤ 14 days → `day`
- 15 ≤ range ≤ 95 days → `week`
- > 95 days OR no range (`all`) → `month`

Bucket size returned to client so axis labels and tooltips match.

**Distinct-customer semantics:**
- The trend's `meetings` and `signed` fields count **distinct customers** within each bucket (not total event count). A customer with 3 meetings in one week contributes `1` to that week's `meetings`. This matches the user's "max 1 meeting per customer" requirement and prevents heavy-meeting customers from inflating the line.

**SQL approach:**
- Funnel: 4 parallel `db.$count` calls, each with the appropriate `EXISTS` subquery
- Trend: one query with `date_trunc(bucket, ...)` GROUP BY, joining customers/meetings/projects with `COUNT(DISTINCT customer_id)`. May need a CTE per series and FULL OUTER JOIN, OR three separate queries unioned in JS by `bucketStart`. Chosen approach: **three parallel queries + JS union** — simpler, leverages existing `isSignedCustomerSql`, doesn't require building a date series in SQL. Backfill missing buckets with zeros in JS.

**Range resolution:** when both `from` and `to` are missing (chip = `all`), the trend uses min(customer.created_at) for this source as the lower bound. Buckets always go up to `now`.

### Client — three new components

| File | Role |
|---|---|
| `src/features/lead-sources-admin/ui/components/lead-source-analytics-panel.tsx` | Top-level composition. Owns the `useQuery` for `getAnalytics`. Receives `leadSourceId`, `chip`. Passes funnel + trend data + bucket down. |
| `src/features/lead-sources-admin/ui/components/lead-source-funnel.tsx` | Pure presentation. Receives `funnel: FunnelData` + `chip`. Renders 4 horizontal bars + drop-off labels. |
| `src/features/lead-sources-admin/ui/components/lead-source-trend-chart.tsx` | Pure presentation. Receives `trend: TrendData[]` + `bucket`. Renders Recharts `<LineChart>` with 3 series. |

**Deletion:** `lead-source-analytics-placeholder.tsx` (no longer used).

**Wiring:** `source-detail.tsx` Analytics tab content swaps `<LeadSourceAnalyticsPlaceholder />` → `<LeadSourceAnalyticsPanel leadSourceId={source.id} chip={chip} />`.

### Lib helpers

- `src/features/lead-sources-admin/lib/format-bucket-label.ts` — pure function `formatBucketLabel(iso: string, bucket: 'day' | 'week' | 'month'): string`. Handles `MMM d`, `MMM d` (week start), `MMM yyyy`. Uses `date-fns` (already in project).
- `src/features/lead-sources-admin/lib/compute-funnel-rates.ts` — pure function `computeFunnelRates(funnel: FunnelData): { meetingsRate, proposalsRate, signedRate }` returning fractions for drop-off labels. Handles divide-by-zero.

## Layouts

### Funnel — `lead-source-funnel.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ Funnel · {time-range clause}                            │
│                                                          │
│ Leads             ████████████████████████████████  187 │
│                                                   −42%  │
│ Meetings booked   ████████████████████              108 │
│                                                   −57%  │
│ Proposals sent    ████████                           46 │
│                                                   −41%  │
│ Signed            ████                               27 │
└─────────────────────────────────────────────────────────┘
```

**Visual rules:**
- Bars: `h-8`, `rounded-md`, `bg-foreground/10` for steps 1-3, `bg-foreground` for Signed (the single primary-color moment)
- Bar width: `count / leads * 100%` (Leads always 100%)
- Step label: `text-sm font-medium` left, fixed width column for alignment
- Count: `text-sm tabular-nums` right
- Drop-off labels: `text-[11px] text-muted-foreground tabular-nums`, positioned between rows, right-aligned
- Header: `text-sm font-medium text-muted-foreground` with the time-range clause from `formatTimeRangeClause(chip)`

**Empty / edge cases:**
- Zero leads in range → `<EmptyState title="No leads in this range" description="Try a longer time range, or check the Customers tab.">` with a chip-shaped icon (`InboxIcon` lucide, `size={48}`)

### Trend — `lead-source-trend-chart.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ Activity over time · {bucket-clause}                    │
│                                                          │
│  20 ┤                                                   │
│  15 ┤   ── Leads                                        │
│  10 ┤   ── Meetings                                     │
│   5 ┤   ── Signatures                                   │
│   0 └────────────────────────────────────────────────   │
│       Apr 14   Apr 21   Apr 28   May 5                  │
└─────────────────────────────────────────────────────────┘
```

**Visual rules:**
- Recharts `<LineChart>` (or `<ComposedChart>` if we add a count overlay later)
- Three `<Line>` series: `leads` (foreground), `meetings` (foreground/60), `signed` (accent or `chart-2` token)
- `strokeWidth={2}`, `dot={false}`, `activeDot={{ r: 4 }}`
- `<Tooltip>` shows: bucket date · leads · meetings · signed · signed-rate (`signed / leads`)
- `<XAxis>`: tick formatter calls `formatBucketLabel(value, bucket)`
- `<YAxis>`: `tickFormatter={formatAsCount}`, `tabular-nums`
- `<CartesianGrid strokeDasharray="3 3" vertical={false} />` — horizontal lines only
- `<Legend>`: bottom, small text
- Container height: `h-64` (256px)
- Width: `100%` via `<ResponsiveContainer>`

**Empty / edge cases:**
- Zero activity in range → `EmptyState` "No activity in this range"
- Single bucket (e.g. 7d range with all activity in one day) → render the line with two points (start + end) so it's visible

### Panel composition — `lead-source-analytics-panel.tsx`

```tsx
<div className="space-y-6">
  <LeadSourceFunnel funnel={data.funnel} chip={chip} />
  <LeadSourceTrendChart trend={data.trend} bucket={data.bucket} chip={chip} />
</div>
```

No nested cards. No section borders between funnel and trend — `space-y-6` is enough vertical separation. Each component owns its own header text.

### Loading / error states

- Loading skeleton (per UI playbook §3): match final layout shape
  - Funnel skeleton: 4 stacked `h-8` skeleton bars + drop-off label slots
  - Trend skeleton: `h-64` skeleton block

- Error state: `<ErrorState />` from `@/shared/components/states/`

- Both share one query, so loading and error are panel-level (not per-visualization).

## Range scoping & data flow

```
source-detail.tsx
  ├─ chip (TimeRangeChip)            ← already managed here
  ├─ resolvedRange = resolveTimeRange(chip)
  └─ <Tabs>
       └─ <TabsContent value="analytics">
            └─ <LeadSourceAnalyticsPanel
                 leadSourceId={source.id}
                 chip={chip}
                 from={resolvedRange.from}
                 to={resolvedRange.to}
              />
                 │
                 └─ useQuery(getAnalytics({ id, from, to }), { placeholderData: keepPreviousData })
```

`placeholderData: keepPreviousData` ensures chip switches don't flicker the analytics tab — same rule as the customer-count badge.

## Self-audit against UI playbook

Banned-pattern checklist run against the proposed design:

- [x] **Single primary-color moment:** the filled Signed bar in the funnel. Trend lines use foreground/foreground-60/accent — accent appears only there.
- [x] **No nested cards:** Panel is `space-y-6`; funnel and trend are flat.
- [x] **No uppercase-tracked-wide labels per row:** headers are `text-sm font-medium text-muted-foreground`, not uppercase.
- [x] **No full-width primary hover on list items:** funnel rows are not hoverable.
- [x] **No destructive-color-only-on-hover:** N/A.
- [x] **Touch targets:** chart tooltips use Recharts defaults (≥44px hit zones via `activeDot`); chip is already `h-11` on mobile.
- [x] **`tabular-nums`** on every count.
- [x] **Empty states use `EmptyState`** primitive, not inline divs.
- [x] **Loading uses Skeleton primitives**, not inline `bg-muted animate-pulse`.

## Risks

- **Recharts SSR:** Recharts is client-only. The trend chart file must `'use client'` and be lazy-loaded if we want Suspense boundaries (current spec doesn't require code-splitting; if bundle size is a concern post-merge, wrap in `next/dynamic` later).
- **Distinct-customer SQL:** the trend's `COUNT(DISTINCT customer_id) GROUP BY date_trunc(bucket, event_at)` pattern is well-supported in Postgres but requires careful index review. Drizzle's SQL builder handles this; we'll inspect the explain plan during implementation if perf is a concern.
- **Bucket boundary in tooltip:** `bucketStart` is the start of the bucket, but tooltips should show "week of Apr 14" or "Apr 14–20" to be unambiguous. Resolution: tooltip formatter constructs the label from `bucketStart + bucket` size (e.g. `format(bucketStart, 'MMM d') + ' – ' + format(addDays(bucketStart, 6), 'MMM d')` for week buckets).

## Phase 3 future scope (separate PR)

- **Funnel × time** — week-bucketed table (week rows × Leads/Meetings/Proposals/Signed cols). Lower priority because trend covers the primary diagnostic.
- **Cohort** — lead-creation-week × outcome (signed/dead/open). Lowest priority for the weekly-health-check workflow.
- **Range-scoped `totalSales`** — make the KPI strip's totalSales chip-respecting.
- **Funnel × time may obviate the standalone funnel** — re-evaluate when implementing.

## Rollback

Revert the PR. The new tRPC procedure is additive; deleting it is safe. The Analytics tab returns to the placeholder.

## Files touched

**New:**
- `src/features/lead-sources-admin/ui/components/lead-source-analytics-panel.tsx`
- `src/features/lead-sources-admin/ui/components/lead-source-funnel.tsx`
- `src/features/lead-sources-admin/ui/components/lead-source-trend-chart.tsx`
- `src/features/lead-sources-admin/lib/format-bucket-label.ts`
- `src/features/lead-sources-admin/lib/compute-funnel-rates.ts`

**Modified:**
- `src/trpc/routers/lead-sources.router.ts` — add `getAnalytics` procedure
- `src/features/lead-sources-admin/ui/components/source-detail.tsx` — swap placeholder for panel; pass chip + resolved range

**Deleted:**
- `src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx`

## Verification

- `pnpm tsc` clean
- `pnpm lint` no new warnings on touched files
- Manual: navigate to a lead source with ≥10 customers, switch chips, verify funnel + trend update; verify drop-off rates match (count / leads × 100); verify tooltip; verify zero-state with a fresh source
