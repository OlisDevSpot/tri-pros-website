# Analytics Framework Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, dependency-free core of the config-driven analytics framework — the `source` / `metric` / `bucket` builders and the `resolve()` engine — so later plans can add real data sources, buckets, a router, and UI on top.

**Architecture:** Three layers (per spec §5): **Sources** acquire data as rows keyed by a business dimension; **Metrics** are config descriptors that declare their source dependencies by reference and derive a value via a pure `value` (per-key series) and/or `total` (aggregate) function; the **Resolver** collects the unique sources across a bucket's metrics, loads each exactly once (dedup by identity), inner-joins them on their shared key, and runs the compute functions. This first plan implements only the engine with fully-typed builders — no DB, no network, no UI.

**Tech Stack:** TypeScript (strict), no runtime dependencies. Verified with `pnpm tsc` + `pnpm lint` (this repo has no test runner by convention).

## Global Constraints

Copied verbatim from spec §4 (N1–N6) and repo conventions; every task implicitly includes these:
- **Pure core:** framework core imports NO database, provider, network, or React code. It must remain runnable in isolation.
- **Serializable results:** `resolve()` returns plain data only (strings/numbers/booleans/plain objects) — it crosses the tRPC boundary later, so no functions/Dates/Maps in `MetricResult`.
- **Type inference without author-written generics:** builders (`source`/`metric`/`bucket`) carry the generics internally; downstream authors write plain object literals and get full inference.
- **Named exports only** (repo coding convention). No default exports.
- **No new libraries.**
- **Path alias:** `@/` → `src/`.
- **Verification per task:** `pnpm tsc` (0 errors) + `pnpm lint` (0 errors) before every commit. Never run `pnpm build`.
- **No columns added to existing tables** anywhere in the analytics work (not relevant to this plan — pure core — but holds across the feature).

---

### Task 1: Framework types + builders

**Files:**
- Create: `src/shared/domains/analytics/types.ts`

**Interfaces:**
- Produces:
  - `type DateRange = { start: Date; end: Date }`
  - `type AnalyticsFilters = { adSetKeys?: string[]; funnelSlugs?: string[] }`
  - `type SourceContext = { range: DateRange; filters?: AnalyticsFilters }`
  - `type MetricFormat = 'currency' | 'percent' | 'ratio' | 'number' | 'duration'`
  - `type SourceRow = Record<string, unknown>`
  - `type Source<Row extends SourceRow, K extends keyof Row> = { key: K; load: (ctx: SourceContext) => Promise<Row[]> }`
  - `function source<Row, K>(def): Source<Row, K>`
  - `type AnySource = Source<any, any>`
  - `type MergedRow<From> = { [P in keyof From]: RowOf<From[P]> }`
  - `type Metric<From> = { name; from; value?; total?; format; interpret?; trend?; available? }`
  - `function metric<From>(def): Metric<From>`
  - `type AnyMetric = Metric<any>`
  - `type BucketSection = { title: string; metrics: AnyMetric[] }`
  - `type Bucket = { name: string; sections: BucketSection[] }`
  - `function bucket(def): Bucket`

- [ ] **Step 1: Create `src/shared/domains/analytics/types.ts` with the full contents below**

```ts
// Analytics framework — core contracts + builders. Pure: no DB/network/React imports.
// See docs/superpowers/specs/2026-07-28-analytics-feature-marketing-sales-design.md#5-architecture

export type DateRange = { start: Date; end: Date }

export type AnalyticsFilters = {
  adSetKeys?: string[]
  funnelSlugs?: string[]
}

export type SourceContext = {
  range: DateRange
  filters?: AnalyticsFilters
}

export type MetricFormat = 'currency' | 'percent' | 'ratio' | 'number' | 'duration'

export type SourceRow = Record<string, unknown>

/**
 * A Source acquires data as rows keyed by one business dimension (`key`).
 * Local (SQL) and remote (provider) sources both satisfy this shape, so the
 * resolver treats them identically.
 */
export type Source<Row extends SourceRow, K extends keyof Row> = {
  key: K
  load: (ctx: SourceContext) => Promise<Row[]>
}

export function source<Row extends SourceRow, K extends keyof Row>(
  def: Source<Row, K>,
): Source<Row, K> {
  return def
}

// Heterogeneous source collections (a metric's `from`) need a widened element type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySource = Source<any, any>

type RowOf<S> = S extends Source<infer Row, keyof Row> ? Row : never

/**
 * The row a metric's `value` receives: one namespaced object per joined key,
 * e.g. `{ adStats: {...}, leads: {...} }`. Namespacing avoids column collisions
 * across sources.
 */
export type MergedRow<From extends Record<string, AnySource>> = {
  [P in keyof From]: RowOf<From[P]>
}

/**
 * A Metric derives a KPI from one or more sources.
 * - `value(row)` → a per-key series (e.g. CPL per adKey).
 * - `total(rows)` → an honest aggregate (e.g. overall CPL = Σspend / Σleads,
 *   never a mean of per-key values).
 * At least one of `value`/`total` must be provided.
 * `available: false` marks an instrumentation-needed metric (declared, dark).
 */
export type Metric<From extends Record<string, AnySource> = Record<string, AnySource>> = {
  name: string
  from: From
  value?: (row: MergedRow<From>) => number | null
  total?: (rows: MergedRow<From>[]) => number | null
  format: MetricFormat
  interpret?: string
  trend?: boolean
  available?: boolean
}

export function metric<From extends Record<string, AnySource>>(def: Metric<From>): Metric<From> {
  return def
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMetric = Metric<any>

export type BucketSection = { title: string; metrics: AnyMetric[] }

export type Bucket = { name: string; sections: BucketSection[] }

export function bucket(def: Bucket): Bucket {
  return def
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc`
Expected: 0 errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors (the two `eslint-disable-next-line` comments are intentional and scoped to the `any`-widened alias types).

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/analytics/types.ts
git commit -m "feat(analytics): framework core types + source/metric/bucket builders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Resolver engine

**Files:**
- Create: `src/shared/domains/analytics/resolver.ts`

**Interfaces:**
- Consumes (from Task 1): `AnyMetric`, `AnySource`, `Bucket`, `MetricFormat`, `SourceContext`, `SourceRow` from `./types`.
- Produces:
  - `type MetricResult = { name: string; format: MetricFormat; interpret?: string; available: boolean; trend: boolean; series?: Record<string, number | null>; total?: number | null }`
  - `async function resolve(bucketDef: Bucket, ctx: SourceContext): Promise<MetricResult[]>`

**Behavior contract (must hold):**
- Each source object referenced by any *available* metric is `load()`-ed **exactly once**, even if used by multiple metrics (dedup by object identity).
- Sources referenced only by `available: false` metrics are **not** loaded.
- A metric's sources are **inner-joined** on their shared key value: only keys present in every one of the metric's sources produce a merged row.
- `series` keys are the joined key values stringified; `series` present iff `metric.value` provided.
- `total` present iff `metric.total` provided; computed over the inner-joined merged rows.
- `available: false` → result carries `available: false` and no `series`/`total`.

- [ ] **Step 1: Create `src/shared/domains/analytics/resolver.ts` with the full contents below**

```ts
// Analytics resolver: loads each source once, inner-joins per metric, runs value/total.
// Pure orchestration — no DB/network here; sources supply the I/O.
// See docs/superpowers/specs/2026-07-28-analytics-feature-marketing-sales-design.md#53-resolver

import type {
  AnyMetric,
  AnySource,
  Bucket,
  MetricFormat,
  SourceContext,
  SourceRow,
} from './types'

export type MetricResult = {
  name: string
  format: MetricFormat
  interpret?: string
  available: boolean
  trend: boolean
  series?: Record<string, number | null>
  total?: number | null
}

export async function resolve(bucketDef: Bucket, ctx: SourceContext): Promise<MetricResult[]> {
  const metrics = bucketDef.sections.flatMap((section) => section.metrics)

  // 1. Unique sources across available metrics (dedup by object identity).
  const uniqueSources = new Set<AnySource>()
  for (const m of metrics) {
    if (m.available === false) continue
    for (const src of Object.values(m.from) as AnySource[]) uniqueSources.add(src)
  }

  // 2. Load each source exactly once → per-source Map<keyValue, Row>.
  const loaded = new Map<AnySource, Map<unknown, SourceRow>>()
  await Promise.all(
    [...uniqueSources].map(async (src) => {
      const rows = await src.load(ctx)
      const byKey = new Map<unknown, SourceRow>()
      for (const row of rows) byKey.set(row[src.key as string], row)
      loaded.set(src, byKey)
    }),
  )

  // 3. Compute each metric.
  return metrics.map((m) => computeMetric(m, loaded))
}

function computeMetric(m: AnyMetric, loaded: Map<AnySource, Map<unknown, SourceRow>>): MetricResult {
  const base = {
    name: m.name,
    format: m.format,
    interpret: m.interpret,
    trend: m.trend ?? false,
  }

  if (m.available === false) return { ...base, available: false }

  const namedSources = (Object.entries(m.from) as [string, AnySource][]).map(([name, src]) => ({
    name,
    byKey: loaded.get(src) ?? new Map<unknown, SourceRow>(),
  }))

  // Inner join: keep only key values present in every source.
  const [firstSource, ...restSources] = namedSources
  const joinKeys: unknown[] = []
  if (firstSource) {
    for (const key of firstSource.byKey.keys()) {
      if (restSources.every((s) => s.byKey.has(key))) joinKeys.push(key)
    }
  }

  const mergedRows = joinKeys.map((key) => {
    const merged: Record<string, SourceRow> = {}
    for (const { name, byKey } of namedSources) merged[name] = byKey.get(key) as SourceRow
    return { key, merged }
  })

  const result: MetricResult = { ...base, available: true }

  if (typeof m.value === 'function') {
    const series: Record<string, number | null> = {}
    for (const { key, merged } of mergedRows) series[String(key)] = m.value(merged)
    result.series = series
  }

  if (typeof m.total === 'function') {
    result.total = m.total(mergedRows.map((row) => row.merged))
  }

  return result
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc`
Expected: 0 errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/analytics/resolver.ts
git commit -m "feat(analytics): resolver — dedup source load, inner-join, value/total compute

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Public barrel + documented usage example

**Files:**
- Create: `src/shared/domains/analytics/index.ts`

**Interfaces:**
- Consumes: everything from `./types` and `./resolver`.
- Produces: the domain's public surface — re-exports `source`, `metric`, `bucket`, `resolve`, and all types. Later plans import from `@/shared/domains/analytics`.

**Purpose:** One import site for the framework, plus a JSDoc example that pins the intended authoring shape (this doubles as living documentation and a compile-time smoke of the inference — if the example stops type-checking, an API change broke authoring ergonomics).

- [ ] **Step 1: Create `src/shared/domains/analytics/index.ts` with the full contents below**

```ts
// Public surface of the analytics framework. Import from '@/shared/domains/analytics'.
//
// Authoring example (compile-time smoke of builder inference):
//
//   const adStats = source({
//     key: 'adKey',
//     load: async () => [{ adKey: 'showcase/kitchens-hero-01', spend: 120, ctr: 0.03 }],
//   })
//   const leads = source({
//     key: 'adKey',
//     load: async () => [{ adKey: 'showcase/kitchens-hero-01', leads: 4 }],
//   })
//   const cpl = metric({
//     name: 'Cost per Lead',
//     from: { adStats, leads },
//     value: (r) => r.adStats.spend / r.leads.leads,          // r fully typed, namespaced
//     total: (rows) =>
//       rows.reduce((a, r) => a + r.adStats.spend, 0) /
//       rows.reduce((a, r) => a + r.leads.leads, 0),
//     format: 'currency',
//     interpret: 'Rising CPL with flat CTR ⇒ funnel/landing leak, not creative.',
//     trend: true,
//   })
//   const marketing = bucket({ name: 'Marketing', sections: [{ title: 'Cost Efficiency', metrics: [cpl] }] })
//   const results = await resolve(marketing, { range: { start, end } })

export {
  source,
  metric,
  bucket,
  type DateRange,
  type AnalyticsFilters,
  type SourceContext,
  type MetricFormat,
  type SourceRow,
  type Source,
  type AnySource,
  type MergedRow,
  type Metric,
  type AnyMetric,
  type BucketSection,
  type Bucket,
} from './types'

export { resolve, type MetricResult } from './resolver'
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc`
Expected: 0 errors. (If the JSDoc example were live code and the builders lost inference, this would surface — but as a comment it documents intent without adding a runtime artifact.)

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/analytics/index.ts
git commit -m "feat(analytics): public barrel + authoring example for framework core

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## What this plan delivers

A working, importable `@/shared/domains/analytics` framework: `source`/`metric`/`bucket` builders with full type inference, and a `resolve()` engine that dedup-loads sources, inner-joins on shared keys, and computes `value` series + `total` aggregates. No data, no UI yet — those are the next plans.

## Next plans (written after this lands, each with fresh grounding)

1. **Meta insights provider + sync service** — `providers/meta` `fetchAdInsights()` + `schemas/insights.ts` + config fragment (Marketing token, ad-account id) + `meta-insights-sync.service.ts` (native rows → `adKey`-keyed rows via `meta.lock.json`).
2. **Local SQL sources + snapshot table + job** — `sources/local/*` (leads/appointments/signed per adKey; proposal/contract funnel), `analytics_snapshots` table, daily QStash snapshot job (upsert + trailing 28-day window + `provisional`).
3. **Marketing + Sales buckets** — the metric catalog (spec §6) as `buckets/marketing.ts` + `buckets/sales.ts`, including `available: false` instrumentation-needed stubs.
4. **Router + UI** — `analytics.router.ts` (`superAdminProcedure` → `resolve`), `src/features/analytics/*` views/components (Recharts + query-toolkit), flip nav stub on, gate route, prefetch/hydrate.
5. **Doc-staleness fixes** (spec §8) — folded into the relevant plan above (UL project stages + voip fields, `customers/DOCS.md` leadType, overview DocuSign→Zoho).
