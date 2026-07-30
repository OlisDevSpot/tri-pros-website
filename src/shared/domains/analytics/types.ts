// Analytics framework — core contracts + builders. Pure: no DB/network/React imports.
// See docs/superpowers/specs/2026-07-28-analytics-feature-marketing-sales-design.md#5-architecture

export interface DateRange {
  start: Date
  end: Date
}

export interface AnalyticsFilters {
  adSetKeys?: string[]
  funnelSlugs?: string[]
}

export interface SourceContext {
  range: DateRange
  filters?: AnalyticsFilters
}

export type MetricFormat = 'currency' | 'percent' | 'ratio' | 'number' | 'duration'

export type SourceRow = Record<string, any>

/**
 * A Source acquires data as rows keyed by one business dimension (`key`).
 * Local (SQL) and remote (provider) sources both satisfy this shape, so the
 * resolver treats them identically.
 */
export interface Source<Row extends SourceRow, K extends keyof Row> {
  key: K
  load: (ctx: SourceContext) => Promise<Row[]>
}

export function source<Row extends SourceRow, K extends keyof Row>(
  def: Source<Row, K>,
): Source<Row, K> {
  return def
}

// Heterogeneous source collections (a metric's `from`) need a widened element type.
export type AnySource = Source<any, any>

type RowOf<S> = S extends Source<infer Row, infer _K> ? Row : never

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
export interface Metric<From extends Record<string, AnySource> = Record<string, AnySource>> {
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

export type AnyMetric = Metric<any>

export interface BucketSection {
  title: string
  metrics: AnyMetric[]
}

export interface Bucket {
  name: string
  sections: BucketSection[]
}

export function bucket(def: Bucket): Bucket {
  return def
}
