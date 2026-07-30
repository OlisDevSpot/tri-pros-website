# Analytics Feature — Marketing & Sales (Design Spec)

**Date:** 2026-07-28
**Status:** Design — awaiting review
**Scope:** A new super-admin-gated Analytics dashboard section, built on a config-driven KPI framework. Ships two buckets — **Marketing** and **Sales** — and a framework designed to scale to Delivery/QA later.

---

## 1. Purpose

Give the company a single place to locate bottlenecks across its revenue lifecycle by surfacing the KPIs that matter per stage. The immediate driver is Meta ad performance (CRO): we currently cannot see cost-per-lead, cost-per-appointment, or ROAS per creative because Meta spend data and first-party lead/appointment data live in separate worlds. This feature joins them.

The feature is **read-only aggregation**. It owns no business entity; it derives metrics from existing data via a standardized framework.

## 2. Scope

- **In:** Analytics shell (route, nav, gating), the config-driven metric framework (Sources → Metrics → Resolver → Snapshots), the Marketing bucket, the Sales bucket, a Meta Marketing-API **insights** provider method + sync service, a generic snapshot table + scheduled job.
- **Out (future cycles):** Delivery bucket, QA bucket (largely greenfield — no data model yet), anonymous funnel-step pixel instrumentation (formerly "B4" — a data-source enhancement that lights up Marketing funnel drop-off), the drift-detection engine for campaign-as-code (separate track).

## 3. Ground-truths (verified against code, 2026-07-28)

**Architecture / infra**
- **G1.** `src/trpc/routers/lead-sources.router.ts` is the sanctioned read-only aggregation pattern: raw `db` in a `*.router.ts`, `superAdminProcedure`, free-form aggregate shapes, Recharts UI. It already joins `customer_lead_attribution → customers → meetings`. This is the template.
- **G2.** Super-admin gate = `ability.can('manage','all')` via `superAdminProcedure` (`src/trpc/init.ts`) + `protectDashboardPage()` redirect (route) + the `adminItems` nav ternary (`src/features/agent-dashboard/lib/get-sidebar-nav.ts:101`). Role enum includes `super-admin` (`src/shared/constants/enums/user.ts:1`).
- **G3.** The Analytics **route + nav item already exist as disabled stubs** (`src/app/(frontend)/dashboard/analytics/page.tsx`, nav `get-sidebar-nav.ts:106` `enabled:false`). An **unrelated** `src/shared/services/analytics.service.ts` stub exists (all `throw 'not implemented'`) — do NOT overload it; new read logic goes in `analytics.router.ts` + the analytics domain.
- **G4.** Meta **insights are not app-consumable today** — only in `scripts/meta/lib/{marketing-api,client}.ts`. Must add a read method to `src/shared/services/providers/meta/client.ts` (+ `schemas/insights.ts`) and an ACL sync service, per ADR-0003. The provider config fragment (`providers/meta/lib/config.ts`) is CAPI-only today; it needs a Marketing-API token + ad-account id added as optional config (no module-scope env reads; use `createProviderConfig`).

**Data / join spine**
- **G5.** Join spine is intact and 1:1 lossless: `customer_lead_attribution.utmContent = adKey` (`src/shared/db/schema/customer-lead-attribution.ts:23`, PK-as-FK `customerId:18`) → `customers` → `meetings.customerId` (`meetings.ts:24`) → `proposals.meetingId` (`proposals.ts:52`) → `projects` (`projects.customerId:38`, and `meetings.projectId:28`). `adKey` is the Marketing↔Sales join key.
- **G6.** Meta insights key on **numeric ad IDs**; our first-party data keys on **`adKey`**. `scripts/meta/meta.lock.json` (existing campaign-as-code state file, committed to git) already holds the `adKey ↔ numericId` map for every live ad. **Reconciliation = read the lock.** This is the codebase-as-source-of-truth model already in place: the spec defines `adKey`, `sync --apply` records the resulting Meta id in the lock, analytics reads it back. No new artifact.
- **G7.** Sales is the best-instrumented stage: proposal→contract funnel fully timestamped (`proposals.createdAt/sentAt/contractSentAt/contractViewedAt/contractSignedAt/contractDeclinedAt/approvedAt`), `proposal_views.viewedAt`, deal value `proposals.finalTcpCents`, `meetingOutcome`. Win = customer has ≥1 project (`customers` DOCS `#signed-customer-eq-has-project`; reuse `src/shared/entities/customers/lib/signed-customer-sql.ts`).
- **G8.** Marketing first-party: leads per adKey/campaign/`contentCategory` (attribution), appointment-set (`meetings.createdAt` / `customers.metaScheduleSentAt`), funnel step completion for **known leads** (`customer_enrichment`, mutable per-step).

**Constraints**
- **G9.** Meta reporting **restates recent days** and is rate-limited → snapshots must upsert and mark recent periods provisional; remote fetches must be centralized/deduped, never per-metric.
- **G10.** Real measurement gaps we cannot fake: **meeting-held has no timestamp** (`meetings` has `scheduledFor` + `createdAt` only → no true show-rate); lead-stage velocity untimed; project sub-stage dwell untimed; anonymous top-funnel drop-off needs pixel step-events. `customers.pipelineStage` and `projects.pipelineStage` are **untyped `text`** → stage KPIs need a validity filter.
- **G11.** Page data uses the ratified prefetch/hydration pattern (one fire-and-forget `prefetch`, no `loading.tsx`, tiers in the view hook — `docs/codebase-conventions/frontend-stack.md#server-prefetch-two-tiers`). Charts = Recharts (installed, used in lead-sources-admin). Tables = query-toolkit + data-table. Scheduled jobs = QStash/cron.

## 4. Requirements

**Functional**
- **R1.** Super-admin-only Analytics dashboard section with buckets; v1 = Marketing + Sales.
- **R2.** One **config object per bucket** declaring its metrics, grouped into layout **sections**.
- **R3.** Each metric is a descriptor: `name`, `from` (source dependencies by reference), `value` (per-key series) and/or `total` (aggregate), `format`, optional `interpret` note, `trend` (snapshot-eligible) flag.
- **R4.** A **resolver** collects the distinct sources across requested metrics, `load()`s each **once** (dedup by identity), joins sources on their shared `key`, runs `value`/`total`.
- **R5.** Uniform **Source** abstraction over local SQL and remote provider fetches (both return rows keyed by a business dimension).
- **R6.** Cross-source Marketing↔Sales joins on `adKey`/customer spine: **CPL, cost-per-appointment, cost-per-signed, ROAS per creative** (the flagship metrics).
- **R7.** Scheduled **snapshots** (upsert, trailing re-snapshot window) into a generic time-series table + live "refresh" via the same resolver.
- **R8.** Date-range + dimension filters (range; per ad set / creative / funnel where applicable).
- **R9.** Metrics whose data doesn't exist yet are **declared but flagged "instrumentation needed"** in the UI — never faked.

**Non-functional**
- **N1.** Layered architecture: provider → sync service (ACL facade, no DB) → analytics router/domain (aggregation) → feature UI. `superAdminProcedure` on every procedure.
- **N2.** Remote (Meta) fetch centralized + cached, never per-metric.
- **N3.** Metric `value`/`total` fns are pure and unit-testable, independent of data acquisition.
- **N4.** Extensible: new KPI = one `metric({...})`; new data = one `source({...})`; new bucket = one `bucket({...})`. Fully type-inferred, rename-safe (reference-based deps).
- **N5.** Marketing-API token is server-only via `createProviderConfig`; no module-scope `env.*` reads.
- **N6.** No new libraries (Recharts + query-toolkit only).

## 5. Architecture

### 5.1 The three layers

```
SOURCES (acquire)            METRICS (derive)                 RESOLVER (orchestrate)
local SQL  ─┐                metric({                         walk bucket → unique sources
remote Meta ┼─▶ keyed rows   from: { a: srcA, b: srcB },      load() each ONCE (dedup by identity)
            ┘   (by `key`)     value: (r) => …  // per key    join sources on shared `key`
                               total: (rows) => … // scalar   run value/total
                             })                                (same path for live + snapshot cron)
```

### 5.2 API surface (approved)

```ts
// SOURCE: acquisition normalized to rows keyed by a business dimension. Local or remote — opaque to callers.
const adStats = source({
  key: 'adKey',
  load: ({ range }) => metaInsights.byAd(range),   // remote → { adKey, spend, impressions, ctr, cpm, reach, frequency, ... }
})
const leads = source({
  key: 'adKey',
  load: ({ range }) => leadsPerAdKey(range),        // local SQL → { adKey, leads }
})

// METRIC: `from` deps by reference; framework joins them on the shared key and hands `value` one typed merged row.
const cpl = metric({
  name: 'Cost per Lead',
  from: { adStats, leads },
  value: (r) => r.adStats.spend / r.leads.leads,                              // per-adKey series
  total: (rows) => sum(rows, 'adStats.spend') / sum(rows, 'leads.leads'),     // honest overall (not mean-of-means)
  format: money,
  interpret: 'Rising CPL with flat CTR ⇒ funnel/landing leak, not creative.',
  trend: true,                                                                 // snapshot-eligible
})

// BUCKET: grouping + layout.
export const marketing = bucket({
  name: 'Marketing',
  sections: [
    { title: 'Spend & Reach',   metrics: [spend, cpm, ctr, frequency, reach] },
    { title: 'Cost Efficiency', metrics: [cpl, costPerAppointment, roas] },
    { title: 'Funnel',          metrics: [leadRate, apptRate] },
  ],
})
```

- **`value` vs `total` are the whole metric compute API.** `value(row)` → per-key series; `total(rows)` → aggregate scalar. At least one required; both allowed. Aggregates are computed from raw joined rows, never as an average of per-key values.
- **Deps by reference** (`from: { adStats, leads }`) → rename-safe, no string registry, dedup by object identity.
- **Auto-join on shared `key`** → `value` receives one merged, fully-typed row per key.
- **`define*` ceremony dropped**; builders are `source` / `metric` / `bucket`. Type inference lives inside the builders (generics), so authors never hand-write generics.

### 5.3 Resolver

`resolve(bucket, { range, filters })`:
1. Walk `bucket.sections[].metrics[].from{}` → unique set of `source` objects (by identity).
2. `await Promise.all` each `source.load({ range, filters })` **once**; cache by identity.
3. For each metric: join its `from` sources on shared `key` → merged rows; run `value` (→ series) and/or `total` (→ scalar).
4. Return a uniform result: `{ [metricName]: { series?: KeyedValues, total?: number, format, interpret, available } }`.

Live-refresh and the snapshot cron both call `resolve`. Remote sources are internally cached (TTL, keyed by range+breakdown) so repeated resolves within a window don't re-hit Meta.

### 5.4 Snapshots

- Table `analytics_snapshots` (`src/shared/db/schema/analytics-snapshots.ts`): `bucket`, `metricId`, `dimensionKey` (nullable for scalars/`total`), `periodStart` (date), `granularity` (`day`), `value` (numeric), `capturedAt`, `provisional` (bool). Unique on `(metricId, dimensionKey, periodStart, granularity)`.
- **Daily** QStash job runs `resolve` for `trend: true` metrics and **upserts**. Each run **re-snapshots a trailing 28-day window** so Meta's restatements self-correct; periods inside Meta's attribution window are written `provisional: true`.
- Trend charts read snapshots; current-state reads live (or latest snapshot). Sales metrics are first-party/exact → never provisional.

### 5.5 File layout

```
src/shared/domains/analytics/            # engine (server-only)
  types.ts                               # Source / Metric / Bucket contracts + builders (source/metric/bucket)
  resolver.ts                            # resolve(bucket, {range, filters})
  sources/local/*.ts                     # SQL aggregations (leadsPerAdKey, proposalFunnel, ...)
  sources/remote/meta-insights.ts        # wraps meta-insights-sync.service
  metrics/*.ts                           # metric descriptors (marketing/*, sales/*)
  buckets/marketing.ts, buckets/sales.ts # config objects

src/trpc/routers/analytics.router.ts     # superAdminProcedure → resolve; mounted in src/trpc/routers/app.ts
src/shared/services/providers/meta/
  client.ts                              # + fetchAdInsights(...)
  schemas/insights.ts                    # request/response Zod (sibling of lib/)
  lib/config.ts                          # + Marketing token + ad-account id (optional fragment)
src/shared/services/meta-insights-sync.service.ts   # ACL facade: native Meta rows → domain keyed rows (resolves numericId→adKey via meta.lock.json)
src/shared/db/schema/analytics-snapshots.ts         # generic time-series table
# + QStash/cron job invoking the resolver for trend metrics

src/features/analytics/                  # UI (copies lead-sources-admin)
  ui/views/analytics-view.tsx            # owns fetching (useSuspenseQueries per bucket)
  ui/components/*                        # KPI strips, Recharts trend charts, creative-ladder table
  constants/*, lib/*
src/app/(frontend)/dashboard/analytics/page.tsx     # replace stub: protectDashboardPage + prefetch + HydrateClient
# get-sidebar-nav.ts:106 → enabled: true
```

## 6. Business logic — metric catalog

> **Population scope (load-bearing, ratified 2026-07-30):** every metric counts ONLY customers/leads/meetings/proposals that originated from a **paid Meta ad click** — `customer_lead_attribution.utm_source='meta' AND utm_medium='paid'` (written solely by `scripts/meta/sync/ad-link.ts`). This is deliberately NARROWER than `customers.leadSourceId='branded-meta-ads'`, which also includes organic funnel visitors (typed URL/SEO, no ad attribution) and would deflate CPL/CPA/ROAS with free leads. Implemented as a shared `brandedMetaPaidScope` predicate reused by every source and metric. `utmContent`(=adKey) is the ad-level breakdown dimension, not the scope gate.

### Marketing (key: `adKey`, rolled up to ad set / account; date for trends)

| Metric | Sources | Compute | Notes |
|--------|---------|---------|-------|
| Spend, Impressions, Reach, Frequency, CPM, CTR, CPC | `adStats` (remote) | passthrough / `total` sums | |
| Landing-Page-Views, hook-rate/thruplay | `adStats` (remote) | passthrough | reel hook = 3s ÷ impressions |
| Leads | `leads` (local: attribution rows / adKey) | count | |
| Appointments set | `appointments` (local: meetings ⋈ attribution / adKey) | count | |
| **CPL** | `adStats` + `leads` | spend ÷ leads | flagship |
| **Cost per appointment** | `adStats` + `appointments` | spend ÷ appts | flagship |
| Lead→Appt rate | `leads` + `appointments` | appts ÷ leads | |
| **ROAS / Cost-per-signed per creative** | `adStats` + `signedPerAdKey` (local: signed customers / adKey) | spend ÷ signed; value ÷ spend | cross-bucket flagship |
| Own-vs-rent qualified | `attribution.ownership` (local) | ratio | |
| Anonymous entry / step drop-off | pixel step-events *(future — B4)* | — | **instrumentation-needed** |

### Sales (key: period / proposal; some cross-join to `adKey`)

| Metric | Sources | Compute | Notes |
|--------|---------|---------|-------|
| Proposals created / sent | `proposalTimestamps` (local) | count | |
| Proposal open rate | `proposalViews` (local) | opened ÷ sent | by `source` |
| Contract funnel (sent→viewed→signed) | `contractTimestamps` (local) | stepwise ratios | |
| **Win rate** | `signedCustomers` + `proposals` | signed ÷ (proposals or meetings) | signed = has project |
| Avg contract value | `finalTcp` (local) | mean (null = not-computed, not $0) | |
| Sales cycle time | `salesTimestamps` (local) | meeting/proposal.createdAt → contractSignedAt | duration |
| Pipeline $ by stage | `pipelineValue` (local) | sum finalTcp × stage | stage filter for dirty text |
| Meeting-held / show rate | — *(no `completedAt`)* | — | **instrumentation-needed** |

## 7. Measurement gaps & follow-ons (flagged, not built)

> **Decision:** this cycle adds **no columns to existing tables**. The only new table is `analytics_snapshots` (§5.4), which is self-contained. Every gap below is a separate future cycle, not part of this work.

- **Meeting-held timestamp** — adding `meetings.heldAt`/`completedAt` unlocks show-rate and true meeting→proposal velocity. Candidate follow-on. **Out of scope here** (no column added); show-rate ships as instrumentation-needed.
- **Anonymous funnel-step events** (B4) — pixel custom events on funnel entry + step change unlock top/mid-funnel drop-off per creative. Candidate follow-on; slots into the Marketing "Funnel" section.
- **Stage-transition timestamps** (lead-stage, project sub-stage) — would enable velocity/dwell KPIs.
- **`pipelineStage` columns are untyped text** — stage KPIs must filter to valid enum values.

## 8. Doc staleness fixes (fold into implementation)

Surfaced during grounding; code is correct, docs drifted. Fix as part of this work:
1. `docs/ubiquitous-language.md:124` — project stages list is wrong (phantom `permits_pending`/`in_progress`/`punch_list`); use the 11-stage `projectPipelineStages` (`enums/pipelines.ts:46-59`).
2. `docs/ubiquitous-language.md:120` — references non-existent `customers.voipCampaignStatus`/`voipLifecycleTags`; cache lives on `voip_campaign_contacts`.
3. `customers/DOCS.md:145` — `leadType` example values (`facebook_ad`/`referral`) wrong; actual enum is qualification states.
4. `docs/company/overview.md` — "via DocuSign" → Zoho Sign.

## 9. Open decisions — resolved

- **ID reconciliation:** existing campaign-spec + `meta.lock.json`, codebase as source of truth (G6). Convention-only is the documented fallback if lock-reads ever prove painful.
- **Type-safety:** typed `source`/`metric`/`bucket` builders with internal generics (inference without author-written generics).
- **Snapshots:** daily grain, upsert with trailing 28-day re-snapshot, `provisional` flag inside Meta's attribution window.
- **Framework abstraction:** config-driven (Sources → Metrics → Resolver), reference-based deps, auto-join on shared `key`.

## 10. Out of scope

Delivery/QA buckets; drift-detection engine; anonymous funnel pixel instrumentation; any change to campaign-as-code sync behavior; activation of ads.
