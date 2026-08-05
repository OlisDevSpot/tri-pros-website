# Analytics Marketing Bucket + Anchor/Left-Join — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `resolve()` return real Marketing numbers (spend, CPM, link-CTR, leads, appointments, signed, and honest blended **CPL / cost-per-appointment / cost-per-signed / ROAS-proxy per creative**) by (1) adding anchor/left-join support to the resolver so cost ratios count ALL ad spend, and (2) wiring the Plan 2 sources into a Marketing bucket + a bucket registry.

**Architecture:** A metric may declare an `anchor` — the source in its `from` whose keys drive the join (left join); non-anchor sources missing at a key read as `undefined` (compute guards with `?? 0`). Without `anchor`, the resolver keeps its inner join (unchanged). The Marketing bucket is a config object grouping metric descriptors into sections; a registry enumerates buckets for the future router/snapshot job.

**Tech Stack:** TypeScript. Verified with `pnpm tsc` + `npx eslint` (no test runner by repo convention).

## Global Constraints

- **Preserve Plan 1's guarantees:** inner-join metrics (no `anchor`) behave EXACTLY as before; `SourceRow` stays `Record<string, unknown>`; per-metric type inference (concrete namespaced rows, not `any`) must survive.
- **`MetricResult` stays serializable** (plain data — crosses tRPC later).
- **Sources are consumed by reference** (import the Plan 2 source singletons); do not reconstruct them.
- **Named exports only. No new libraries. No schema changes.**
- **Repo lint (`@antfu/eslint-config`):** object-shape aliases → `interface`; union/mapped/generic-ref types → `type`; NO `@typescript-eslint/no-explicit-any` disable comments (rule is off); run `npx eslint --fix <file>` and judge by printed problem count, NOT the shell exit code.
- **Verification per task:** `pnpm tsc` (0 errors) + `npx eslint <files>` (0 problems). Never `pnpm build`. No tests.
- **Path alias:** `@/` → `src/`.

---

### Task 1: Resolver anchor / left-join support

**Files:**
- Modify: `src/shared/domains/analytics/types.ts`
- Modify: `src/shared/domains/analytics/resolver.ts`

**Interfaces:**
- Produces: `Metric` gains an optional second generic `Anchor extends keyof From` and an `anchor?: Anchor` field; `value`/`total` receive `MetricRow<From, Anchor>` (non-anchor slots optional when anchored, all-present when not). `metric()` gains the `Anchor` generic. Resolver honors `anchor` with a left join.

- [ ] **Step 1: In `types.ts`, add the `MetricRow` helper type** (after `MergedRow`):

```ts
/**
 * The row shape a metric's compute receives.
 * - No anchor (inner join): every source present → `MergedRow<From>`.
 * - With anchor (left join): the anchor source is present; every other source
 *   may be missing at a given key, so its slot is `| undefined` and compute must guard.
 */
export type MetricRow<From extends Record<string, AnySource>, Anchor extends keyof From> = [
  Anchor,
] extends [never]
  ? MergedRow<From>
  : { [P in keyof From]: P extends Anchor ? RowOf<From[P]> : RowOf<From[P]> | undefined }
```

- [ ] **Step 2: In `types.ts`, export `RowOf`** so `MetricRow` (and the barrel) can use it — change `type RowOf<S> = ...` to `export type RowOf<S> = ...` (it is currently a private alias; widen to exported). Leave its definition otherwise unchanged.

- [ ] **Step 3: In `types.ts`, replace the `Metric` interface + `metric` builder** with the anchored versions:

```ts
export interface Metric<
  From extends Record<string, AnySource> = Record<string, AnySource>,
  Anchor extends keyof From = never,
> {
  name: string
  from: From
  anchor?: Anchor
  value?: (row: MetricRow<From, Anchor>) => number | null
  total?: (rows: MetricRow<From, Anchor>[]) => number | null
  format: MetricFormat
  interpret?: string
  trend?: boolean
  available?: boolean
}

export function metric<
  From extends Record<string, AnySource>,
  Anchor extends keyof From = never,
>(def: Metric<From, Anchor>): Metric<From, Anchor> {
  return def
}
```

(Leave `AnyMetric = Metric<any, any>` — the extra `any` covers the new generic. Confirm the existing `export type AnyMetric = Metric<any>` still compiles; if tsc requires it, widen to `Metric<any, any>`.)

- [ ] **Step 4: In `resolver.ts`, teach `computeMetric` to honor `anchor`.** Replace the inner-join key computation with anchor-aware logic. The current block computes `joinKeys` as the intersection of all sources. Change it to:

```ts
  const namedSources = (Object.entries(m.from) as [string, AnySource][]).map(([name, src]) => ({
    name,
    src,
    byKey: loaded.get(src) ?? new Map<unknown, SourceRow>(),
  }))

  let joinKeys: unknown[]
  if (m.anchor != null) {
    // Left join: the anchor source's keys drive the result; other sources may be absent.
    const anchorEntry = namedSources.find((s) => s.name === m.anchor)
    joinKeys = anchorEntry ? [...anchorEntry.byKey.keys()] : []
  }
  else {
    // Inner join (unchanged): only keys present in every source.
    const [firstSource, ...restSources] = namedSources
    joinKeys = []
    if (firstSource) {
      for (const key of firstSource.byKey.keys()) {
        if (restSources.every((s) => s.byKey.has(key))) joinKeys.push(key)
      }
    }
  }

  const mergedRows = joinKeys.map((key) => {
    const merged: Record<string, SourceRow | undefined> = {}
    for (const { name, byKey } of namedSources) merged[name] = byKey.get(key)
    return { key, merged }
  })
```

(Note: `merged[name]` is now `SourceRow | undefined` — for inner-join keys every source has the key so it's always present; for anchored keys non-anchor sources may yield `undefined`. The `value`/`total` casts already go through `AnyMetric`, so this compiles; the typed guarantee lives in `MetricRow` at authoring time.)

- [ ] **Step 5:** `pnpm tsc` → 0 errors (this proves inner-join metrics still type-check AND the new `MetricRow` compiles).
- [ ] **Step 6:** `npx eslint src/shared/domains/analytics/types.ts src/shared/domains/analytics/resolver.ts` → 0 problems.
- [ ] **Step 7: Also export `RowOf` and `MetricRow` from the barrel.** In `src/shared/domains/analytics/index.ts`, add `RowOf` and `MetricRow` to the `export type { ... } from './types'` list (keep alphabetical if the file sorts them). Then re-run `pnpm tsc` + `npx eslint src/shared/domains/analytics/index.ts` (0/0).

- [ ] **Step 8: Commit**

```bash
git add src/shared/domains/analytics/types.ts src/shared/domains/analytics/resolver.ts src/shared/domains/analytics/index.ts
git commit -m "feat(analytics): resolver anchor/left-join for honest blended cost metrics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Marketing bucket

**Files:**
- Create: `src/shared/domains/analytics/buckets/marketing.ts`

**Interfaces:**
- Consumes: `bucket`, `metric` from `../types` (or the barrel `..`); the Plan 2 sources `adStats` (`../sources/remote/meta-insights`), `leadsPerAdKey`, `appointmentsPerAdKey`, `signedPerAdKey` (`../sources/local/*`).
- Produces: `export const marketing` — a `Bucket` grouping the metrics below into sections.

**Design notes (read before writing):**
- Source row fields available: `adStats` → `{ adKey, spend, impressions, reach, frequency, cpm, ctr, cpc, inlineLinkClicks, metaLeads, landingPageViews }`; `leadsPerAdKey` → `{ adKey, leads }`; `appointmentsPerAdKey` → `{ adKey, appointments }`; `signedPerAdKey` → `{ adKey, signed }`. All numbers.
- **Derive rate/cost metrics from base counts** (spend, impressions, inlineLinkClicks) rather than passing through Meta's per-ad `cpm/ctr/cpc`, so per-ad `value` and account `total` are computed consistently. Meta's `ctr` is all-clicks; we use `inlineLinkClicks` for a consistent link-CTR.
- **Cost metrics anchor on `adStats`** so ALL ad spend is counted (zero-conversion ads included in the `total` denominator) — this is the whole point of Task 1. Per-ad `value` returns `null` when the conversion count is 0 (undefined CPL is `null`, not `Infinity`).
- **`reach`/`frequency` are non-additive** (dedup metrics) → `value` only, no `total`.
- Include one `available:false` instrumentation-needed stub for anonymous funnel drop-off.

- [ ] **Step 1: Create `src/shared/domains/analytics/buckets/marketing.ts`**

```ts
// Marketing analytics bucket — Meta ad performance joined with first-party
// paid-Meta conversions. Cost metrics anchor on adStats so blended totals count
// ALL ad spend (see resolver anchor/left-join). See spec §6.
import { adStats } from '../sources/remote/meta-insights'
import { appointmentsPerAdKey } from '../sources/local/appointments-per-adkey'
import { leadsPerAdKey } from '../sources/local/leads-per-adkey'
import { signedPerAdKey } from '../sources/local/signed-per-adkey'
import { bucket, metric } from '../types'

// ---- Spend & Reach (single-source: adStats) ----
const spend = metric({
  name: 'Spend',
  from: { adStats },
  value: (r) => r.adStats.spend,
  total: (rows) => rows.reduce((a, r) => a + r.adStats.spend, 0),
  format: 'currency',
  trend: true,
})

const impressions = metric({
  name: 'Impressions',
  from: { adStats },
  value: (r) => r.adStats.impressions,
  total: (rows) => rows.reduce((a, r) => a + r.adStats.impressions, 0),
  format: 'number',
  trend: true,
})

const reach = metric({
  name: 'Reach',
  from: { adStats },
  value: (r) => r.adStats.reach,
  format: 'number',
  interpret: 'Per-ad; not summed (dedup metric — account reach needs an account-level pull).',
})

const frequency = metric({
  name: 'Frequency',
  from: { adStats },
  value: (r) => r.adStats.frequency,
  format: 'number',
  interpret: 'Above ~2 this early = audience too small, re-hitting the same people.',
})

const cpm = metric({
  name: 'CPM',
  from: { adStats },
  value: (r) => (r.adStats.impressions ? (r.adStats.spend / r.adStats.impressions) * 1000 : null),
  total: (rows) => {
    const s = rows.reduce((a, r) => a + r.adStats.spend, 0)
    const i = rows.reduce((a, r) => a + r.adStats.impressions, 0)
    return i ? (s / i) * 1000 : null
  },
  format: 'currency',
  trend: true,
})

const linkCtr = metric({
  name: 'Link CTR',
  from: { adStats },
  value: (r) => (r.adStats.impressions ? r.adStats.inlineLinkClicks / r.adStats.impressions : null),
  total: (rows) => {
    const c = rows.reduce((a, r) => a + r.adStats.inlineLinkClicks, 0)
    const i = rows.reduce((a, r) => a + r.adStats.impressions, 0)
    return i ? c / i : null
  },
  format: 'percent',
  interpret: 'Under ~0.7% ⇒ the creative isn’t earning the click.',
  trend: true,
})

const cpc = metric({
  name: 'CPC (link)',
  from: { adStats },
  value: (r) => (r.adStats.inlineLinkClicks ? r.adStats.spend / r.adStats.inlineLinkClicks : null),
  total: (rows) => {
    const s = rows.reduce((a, r) => a + r.adStats.spend, 0)
    const c = rows.reduce((a, r) => a + r.adStats.inlineLinkClicks, 0)
    return c ? s / c : null
  },
  format: 'currency',
  trend: true,
})

const landingPageViews = metric({
  name: 'Landing Page Views',
  from: { adStats },
  value: (r) => r.adStats.landingPageViews,
  total: (rows) => rows.reduce((a, r) => a + r.adStats.landingPageViews, 0),
  format: 'number',
  trend: true,
})

// ---- Conversions (single-source counts) ----
const leads = metric({
  name: 'Leads',
  from: { leadsPerAdKey },
  value: (r) => r.leadsPerAdKey.leads,
  total: (rows) => rows.reduce((a, r) => a + r.leadsPerAdKey.leads, 0),
  format: 'number',
  trend: true,
})

const appointments = metric({
  name: 'Appointments',
  from: { appointmentsPerAdKey },
  value: (r) => r.appointmentsPerAdKey.appointments,
  total: (rows) => rows.reduce((a, r) => a + r.appointmentsPerAdKey.appointments, 0),
  format: 'number',
  trend: true,
})

const signed = metric({
  name: 'Signed',
  from: { signedPerAdKey },
  value: (r) => r.signedPerAdKey.signed,
  total: (rows) => rows.reduce((a, r) => a + r.signedPerAdKey.signed, 0),
  format: 'number',
  trend: true,
})

// ---- Cost efficiency (anchor on adStats so ALL spend counts) ----
const cpl = metric({
  name: 'Cost per Lead',
  from: { adStats, leadsPerAdKey },
  anchor: 'adStats',
  value: (r) => {
    const leadCount = r.leadsPerAdKey?.leads ?? 0
    return leadCount ? r.adStats.spend / leadCount : null
  },
  total: (rows) => {
    const s = rows.reduce((a, r) => a + r.adStats.spend, 0)
    const l = rows.reduce((a, r) => a + (r.leadsPerAdKey?.leads ?? 0), 0)
    return l ? s / l : null
  },
  format: 'currency',
  interpret: 'Rising CPL with flat CTR ⇒ funnel/landing leak, not creative.',
  trend: true,
})

const costPerAppointment = metric({
  name: 'Cost per Appointment',
  from: { adStats, appointmentsPerAdKey },
  anchor: 'adStats',
  value: (r) => {
    const appts = r.appointmentsPerAdKey?.appointments ?? 0
    return appts ? r.adStats.spend / appts : null
  },
  total: (rows) => {
    const s = rows.reduce((a, r) => a + r.adStats.spend, 0)
    const a2 = rows.reduce((a, r) => a + (r.appointmentsPerAdKey?.appointments ?? 0), 0)
    return a2 ? s / a2 : null
  },
  format: 'currency',
  trend: true,
})

const costPerSigned = metric({
  name: 'Cost per Signed',
  from: { adStats, signedPerAdKey },
  anchor: 'adStats',
  value: (r) => {
    const s = r.signedPerAdKey?.signed ?? 0
    return s ? r.adStats.spend / s : null
  },
  total: (rows) => {
    const spendSum = rows.reduce((a, r) => a + r.adStats.spend, 0)
    const signedSum = rows.reduce((a, r) => a + (r.signedPerAdKey?.signed ?? 0), 0)
    return signedSum ? spendSum / signedSum : null
  },
  format: 'currency',
  interpret: 'True acquisition cost per signed contract, all ad spend counted.',
  trend: true,
})

// ---- Funnel rates (anchor on the upstream count) ----
const leadToAppt = metric({
  name: 'Lead → Appointment rate',
  from: { leadsPerAdKey, appointmentsPerAdKey },
  anchor: 'leadsPerAdKey',
  value: (r) => {
    const l = r.leadsPerAdKey.leads
    return l ? (r.appointmentsPerAdKey?.appointments ?? 0) / l : null
  },
  total: (rows) => {
    const l = rows.reduce((a, r) => a + r.leadsPerAdKey.leads, 0)
    const a2 = rows.reduce((a, r) => a + (r.appointmentsPerAdKey?.appointments ?? 0), 0)
    return l ? a2 / l : null
  },
  format: 'percent',
  trend: true,
})

const apptToSigned = metric({
  name: 'Appointment → Signed rate',
  from: { appointmentsPerAdKey, signedPerAdKey },
  anchor: 'appointmentsPerAdKey',
  value: (r) => {
    const a2 = r.appointmentsPerAdKey.appointments
    return a2 ? (r.signedPerAdKey?.signed ?? 0) / a2 : null
  },
  total: (rows) => {
    const a2 = rows.reduce((a, r) => a + r.appointmentsPerAdKey.appointments, 0)
    const s = rows.reduce((a, r) => a + (r.signedPerAdKey?.signed ?? 0), 0)
    return a2 ? s / a2 : null
  },
  format: 'percent',
  trend: true,
})

const anonymousDropOff = metric({
  name: 'Funnel entry / step drop-off',
  from: {},
  format: 'number',
  available: false,
  interpret: 'Instrumentation needed: anonymous pixel step-events (future plan).',
})

export const marketing = bucket({
  name: 'Marketing',
  sections: [
    { title: 'Spend & Reach', metrics: [spend, impressions, reach, frequency, cpm, linkCtr, cpc, landingPageViews] },
    { title: 'Conversions', metrics: [leads, appointments, signed] },
    { title: 'Cost Efficiency', metrics: [cpl, costPerAppointment, costPerSigned] },
    { title: 'Funnel', metrics: [leadToAppt, apptToSigned, anonymousDropOff] },
  ],
})
```

- [ ] **Step 2:** `pnpm tsc` → 0 errors. This is the real proof: it confirms every `value`/`total` type-checks against the concrete source rows, that `anchor: 'adStats'` is a valid key of each cost metric's `from`, and that anchored non-anchor slots are correctly typed `| undefined` (the `?? 0` guards are required by the types).
- [ ] **Step 3:** `npx eslint src/shared/domains/analytics/buckets/marketing.ts` → 0 problems (`--fix` for style; remove any unused helper).
- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/analytics/buckets/marketing.ts
git commit -m "feat(analytics): Marketing bucket — CPL/CPA/cost-per-signed + funnel rates per creative

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Bucket registry

**Files:**
- Create: `src/shared/domains/analytics/buckets/index.ts`
- Modify: `src/shared/domains/analytics/index.ts` (re-export the registry)

**Interfaces:**
- Produces: `export const buckets: Bucket[]` (the enumerable registry the future router + snapshot job iterate), and `export function bucketByName(name: string): Bucket | undefined`.

- [ ] **Step 1: Create `src/shared/domains/analytics/buckets/index.ts`**

```ts
// Registry of analytics buckets. The router and snapshot job enumerate this.
import type { Bucket } from '../types'
import { marketing } from './marketing'

export const buckets: Bucket[] = [marketing]

export function bucketByName(name: string): Bucket | undefined {
  return buckets.find((b) => b.name === name)
}
```

- [ ] **Step 2: Re-export from the domain barrel `src/shared/domains/analytics/index.ts`** — add a value export line: `export { bucketByName, buckets } from './buckets'` (place with the other value re-exports; keep the file's grouping/sorting convention).

- [ ] **Step 3:** `pnpm tsc` → 0 errors + `npx eslint src/shared/domains/analytics/buckets/index.ts src/shared/domains/analytics/index.ts` → 0 problems.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/analytics/buckets/index.ts src/shared/domains/analytics/index.ts
git commit -m "feat(analytics): bucket registry (buckets + bucketByName)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## What this plan delivers

`resolve(marketing, { range })` now returns real per-creative and blended Marketing KPIs — spend, CPM, link-CTR, CPC, LPV, leads, appointments, signed, and honest **CPL / cost-per-appointment / cost-per-signed** (all ad spend counted via anchor/left-join), plus lead→appt and appt→signed rates — scoped to paid Meta clicks. A registry enumerates buckets for the router and snapshot job.

## Self-review notes

- Spec §6 Marketing catalog implemented (minus revenue-based ROAS, which needs a contract-value source — deferred to the Sales plan). `available:false` stub present for anonymous funnel drop-off.
- Task 1 preserves inner-join behavior for all non-anchored metrics (Plan 1 guarantee) and keeps `SourceRow` = `unknown`.
- No schema changes; sources consumed by reference (dedup-safe).

## Next plans

4. **Sales sources + Sales bucket** — new local sources (proposal/contract timestamps, `proposal_views`, `finalTcpCents` per adKey) + the Sales metric catalog; also enables revenue-based **ROAS** in Marketing.
5. **Snapshot table + job** — `analytics_snapshots` + daily QStash job iterating `buckets[]`'s `trend:true` metrics (upsert + trailing window + provisional). Add `outputFileTracingIncludes` for `meta.lock.json` here.
6. **Router + UI** — `analytics.router.ts` (`superAdminProcedure` → `resolve` over `buckets`) + `src/features/analytics/*`, nav flip, gating, prefetch/hydrate.
