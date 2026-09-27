# Spec F — Analytics page v1 (with lead-source spend)

**Status:** draft for owner review, 2026-09-27.
**Tracker:** `docs/plans/2026-09-26-analytics-epic.md` (rules are cited by ID there, never restated here).
**Owns:** F1–F9, F11, F12 and, folded in by C46, E1–E3. **F10 is not in this spec** (C46): the old lead-sources analytics stays until a cleanup spec at the end of the epic.
**Builds on:** Spec A's rule layer (`src/features/analytics/lib/`, `dal/server/load-analytics-facts.ts`), shipped d9347269..c5a82908.
**Layout reference:** the warm-up page https://claude.ai/artifact/YbAcMRCyMJe7zgeBSjU1x9 — owner pick: option A's layout with option C's focus bar chart and its "Data to fix" panel.

## 1. Purpose

One super-admin page that answers "is the lead chain healthy?" for a chosen period, per source and in total, with money and cost beside the counts (C1, C23). The owner opens it:

1. **Mid-month** — progress so far and company health.
2. **Month-end** — the month's overview.
3. **Longer term** — last quarter, year to date.
4. Later, still important — closer review and data cleanup.

There is no period-over-period comparison; a 12-month trend with the selected months highlighted carries "how are we doing" (C46).

## 2. Scope

**In:** the page and its nav item (F1, F2); the global filter bar (F3, C21); tabs Overview, Leads, Appointments, Sales, Projects placeholder (F4–F8); the spend storage, rules and entry grid (E1–E3, F9); "not available yet" for data that has not landed (F11); every number from the rule layer (F12); two small proposals-table filters so hygiene counts can link out.

**Out:** retiring `lead-sources-admin` analytics (F10 → end-of-epic cleanup spec); junk / valid / test (Spec C), setter (Spec D), cancelled / net (Spec B) — each shows "not available yet"; a customers-table filter for unknown city / zip (waits for Records R2); the design polish pass (§9).

## 3. Architecture

```
page.tsx (server; super-admin guard; prefetch)
  └─ AnalyticsView (client; URL state)
       └─ trpc.analyticsRouter.report(input)                      superAdminProcedure
            └─ getAnalyticsReport(input, now)                     features/analytics/dal/server
                 ├─ loadAnalyticsFacts()                          Spec A
                 ├─ listLeadSourceSpend(monthKeys)                entities/lead-sources/dal/server
                 └─ buildAnalyticsReport(facts, spend, input, now)  features/analytics/lib (pure)
                      ├─ buildLeadRecords(facts, now)             Spec A
                      ├─ aggregateLeadRecords(...)  × headline, breakdown, 12-month trend
                      └─ spend + cost rules                       analytics-rules.ts
```

- **One report per filter state (C46).** The browser never counts; it only renders the report.
- **No raw `db` in the router** (ADR-0002). The router validates input and calls the feature server function.
- **Scale:** whole-table reads per request are fine at ~770 customers (C30). Revisit only on the C30 trigger.

## 4. Rule layer additions (`src/features/analytics/lib/analytics-rules.ts`, each with a one-line why and a numbered check in `scripts/verify-analytics-rules.ts`, per C38)

| Rule | Export | Behavior |
|---|---|---|
| Merged duplicates | aggregator field `mergedRecords` | For each lead counted in a row, `customerIds.length − 1`; follows lead applicability. Shown on the Leads tab. |
| Spend in a period | `spendInRange(entries, range, today)` | Each `(source, month)` amount counts × (days of that month inside the range ÷ days in the month); the current business month counts only days elapsed through today (Pacific). |
| Spend missing | part of the report's cost block | A `manual` source with ≥1 lead in a month of the range and no spend row for that month ⇒ that row's costs are "missing" and name the source-months. The total row inherits any missing month. |
| Free sources | `spendMode = 'none'` | Spend is always 0 and never missing. |
| Cost per stage | `ANALYTICS_COSTS` | spend ÷ leads, ÷ booked leads, ÷ sits, ÷ new sales; revenue (new + upsell) ÷ spend. Any zero denominator ⇒ `null`. |
| Cost applicability | extends `inapplicableStages` | Cost is not applicable unless the grouping is `total`, `leadSource` or `month` and the only person/event filter is lead source. Otherwise "not applicable" with a reason. |

The aggregator stays free of inline rule logic (C38). Rates keep Σ÷Σ (C36).

## 5. Spend storage (E1–E3; data owned by the lead-source entity, C26)

- **Table `lead_source_monthly_spend`:** `id`, `leadSourceId` (FK → `lead_sources.id`, cascade on delete), `month` (`'YYYY-MM'`, a Pacific business month), `amountCents` (integer ≥ 0), `createdAt`, `updatedAt`. Unique `(leadSourceId, month)`. A child table, not JSONB (ADR-0005).
- **Column `lead_sources.spend_mode`:** pgEnum `lead_source_spend_mode` = `manual | none`, default `manual`. Values in `src/shared/constants/enums/`, pgEnum beside the others, per the repo pattern.
- **DAL** in `src/shared/entities/lead-sources/dal/server/`: list spend for a set of months; upsert one cell; delete one cell (a cleared cell = not entered); set a source's spend mode. `dalDbOperation` shape.
- **Schema push:** owner runs `pnpm db:push:dev`, then prod only when asked.

## 6. API (`src/trpc/routers/analytics.router.ts`, registered in `app.ts`; every procedure `superAdminProcedure`)

- `report({ period, filters, groupBy, tab })` returns:
  - `headline`: the total row plus costs;
  - `breakdown`: rows plus costs;
  - `trend`: 12 monthly total rows ending with the period's last month;
  - `notApplicable`: stages and cost, each with a reason;
  - `spendMissing`: the source-months that are missing;
  - `undatedSales`, `orphans`;
  - `hygiene`: meetings with no outcome, undated sales, new sales without a project, leads with unknown city or zip.
- **Periods:** `this-month | last-month | this-quarter | last-quarter | ytd | last-12 | custom{from,to}`, resolved in Pacific time with `business-time.ts` (C7). "This month" is the full calendar month; its data naturally stops today.
- `filterOptions()` — known cities and zips from the lead records. Sources come from `leadSourcesRouter.list`; closer names from `meetingsRouter.reads.getInternalUsers`.
- `spend.list({ months })`, `spend.set({ leadSourceId, month, amountCents | null })`, `spend.setMode({ leadSourceId, mode })` — call the entity DAL.

## 7. Page (layout = warm-up A + C's bar chart and Data to fix)

- **Route / guard / nav (F1, F2, I10):**
  - `src/app/(frontend)/dashboard/analytics/page.tsx` gets the `ability.cannot('manage', 'all')` redirect from `lead-sources/page.tsx`.
  - The page prefetches the report.
  - `get-sidebar-nav.ts` flips Analytics to `enabled: true`.
- **URL state** (nuqs): period, filters, tab, group-by and focus metric, so every view can be bookmarked.
- **Order, top to bottom:**
  1. **Header:** "Analytics" with a one-line subtitle.
  2. **Filter bar (C21, C36):**
     - Period chips, with the resolved range shown as text ("Sep 1 – 27, 2026").
     - A Filters popover (frosted glass) for source, city, zip, closer, outcome and meeting order, with active filters shown as removable chips.
  3. **Tabs:** Overview · Leads · Appointments · Sales · Projects, with **Spend** at the far right. Spend carries a warning dot when any month in the trend window is missing spend.
  4. **Headline strip:** the tab's figures in one hairline row, rates under each.
     - The figures are **selectable**; the selected one is the focus metric. This is my merge of A's strip with C's stage selection; the owner confirms it at spec review.
     - A figure that doesn't apply shows "n/a", and a single line under the strip gives the reason. Spend missing shows a "Spend missing" chip that opens the Spend grid.
  5. **Focus trend + Data to fix, side by side:**
     - **Left:** 12 monthly bars for the focus metric, with the selected months in cobalt.
     - **Right:** the tab's hygiene counts, each linking out (§8). The panel is labelled "all records, not narrowed by these filters".
  6. **Breakdown:**
     - A Group-by switch, with the total row first.
     - The column for the focus metric is highlighted and the rows are sorted by it.
     - Rows with no value read "Unknown source", "Unknown city", "Unassigned" (C44) or "Undated".
     - Closer rows carry the overlap note (C19).
- **Tabs content** (the same three parts each; the figures come from §3's report):

| Tab | Headline figures | Default focus | Group by | Data to fix |
|---|---|---|---|---|
| Overview | Leads, booked leads, sits, new sales, revenue, spend (+ booking / sit / close rates, cost per sale) | Sits | source, month, closer, city, zip | all four counts |
| Leads | Total leads, merged duplicates, cost per lead; valid leads and junk rate "not available yet" | Leads | source, city, zip, month | unknown city / zip |
| Appointments | Booked leads, sits, sit rate, meetings, meetings with no outcome; setter "not available yet" | Sits | closer, outcome, meeting order, source | meetings with no outcome |
| Sales | New sales, total closes, revenue (new vs upsell), average ticket, close rate; cancelled / net "not available yet" | New sales | closer, source, month | undated sales, sales without a project |
| Projects | Placeholder (C25) | — | — | — |

- **Spend view (F9):**
  - A grid of `manual` sources × the 12 months ending with the selected period.
  - Each cell is a dollar input that saves on blur. A blank cell is "not entered"; clearing a cell deletes its row.
  - Missing cells are marked in the warning color.
  - A row menu sets a source's spend mode. Free sources are listed below the grid.
- **Phone (390):**
  - The headline goes two-up, and the period becomes a select.
  - The Filters popover becomes a full-width sheet.
  - Data to fix stacks under the chart.
  - The breakdown scrolls sideways with its first column pinned.
- **States:**
  - A skeleton while the report loads.
  - An error state with a retry.
  - A zero is shown as 0.
  - "n/a" always carries its reason, and "not available yet" names the spec that brings the data.
- **Design system:**
  - Command Desk tokens only, with cobalt reserved for action and selection.
  - Syne for headings and Nunito for body text.
  - recharts for the bars.
  - shadcn Tabs, Table, Select and Popover.

## 8. Data-to-fix links (the records tables' existing URL state)

| Count | Link |
|---|---|
| Past meetings with no outcome | `/dashboard/meetings?pm_outcome=not_set&pm_scheduledFor={"to":<now>}` — works today |
| Undated sales | `/dashboard/proposals?pp_status=approved&pp_missingApprovedAt=true` — **new boolean filter** `missingApprovedAt` (schema + `buildFilterWhere` in `src/shared/modules/proposals/core/dal/server/queries.ts`, entry in `src/features/proposal-flow/constants/proposal-table-filter-config.ts`), copying `sentNoContract` |
| New sales without a project | `/dashboard/proposals?pp_kind=initial-sale&pp_status=approved&pp_noProject=true` — **new boolean filter** `noProject` (`isNull(meetings.projectId)`), same files |
| Leads with unknown city / zip | count only; the link waits for Records R2 (noted in the tracker) |

## 9. Follow-ups this spec creates

- **A thorough `/impeccable` pass on the page** once it works in code (owner, 2026-09-27).
- **End-of-epic cleanup spec:** retire `lead-sources-admin` analytics (F10, C46). Until then, each source's page gets a "View in Analytics" link that opens this page filtered to that source (additive only).
- **Unknown city / zip link** after Records R2.

## 10. Verification

- **Rules script:** `pnpm tsx scripts/verify-analytics-rules.ts`, with new numbered checks for merged duplicates, spend proration (a past month, the current month to date, a custom range that splits a month), spend missing, the free spend mode, cost applicability and `ANALYTICS_COSTS`.
- **Gates:** `pnpm tsc` and `pnpm lint`. Never `pnpm build`.
- **Pages:** Playwright on the dev server as the synthetic super-admin. Every tab renders at 1440 and 390, in light and dark; the closer filter shows "n/a"; the missing-spend chip opens the grid.
- **Real data:** a read-only prod run of `report` (`DRIZZLE_TARGET=prod`), checked against the tracker's §7 tally.
- **Spend grid saving:** checked by the owner by hand. No test writes to the database.
