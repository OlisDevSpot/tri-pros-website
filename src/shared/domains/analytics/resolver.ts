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

export interface MetricResult {
  name: string
  format: MetricFormat
  interpret?: string
  available: boolean
  trend: boolean
  series?: Record<string, number | null>
  total?: number | null
}

export async function resolve(bucketDef: Bucket, ctx: SourceContext): Promise<MetricResult[]> {
  const metrics = bucketDef.sections.flatMap(section => section.metrics)

  // 1. Unique sources across available metrics (dedup by object identity).
  const uniqueSources = new Set<AnySource>()
  for (const m of metrics) {
    if (m.available === false)
      continue
    for (const src of Object.values(m.from) as AnySource[]) uniqueSources.add(src)
  }

  // 2. Load each source exactly once → per-source Map<keyValue, Row>.
  const loaded = new Map<AnySource, Map<unknown, SourceRow>>()
  await Promise.all(
    [...uniqueSources].map(async (src) => {
      const rows = await src.load(ctx)
      const byKey = new Map<unknown, SourceRow>()
      for (const row of rows)
        byKey.set(row[src.key as string], row)
      loaded.set(src, byKey)
    }),
  )

  // 3. Compute each metric.
  return metrics.map(m => computeMetric(m, loaded))
}

function computeMetric(m: AnyMetric, loaded: Map<AnySource, Map<unknown, SourceRow>>): MetricResult {
  const base = {
    name: m.name,
    format: m.format,
    interpret: m.interpret,
    trend: m.trend ?? false,
  }

  if (m.available === false)
    return { ...base, available: false }

  const namedSources = (Object.entries(m.from) as [string, AnySource][]).map(([name, src]) => ({
    name,
    byKey: loaded.get(src) ?? new Map<unknown, SourceRow>(),
  }))

  // Inner join: keep only key values present in every source.
  const [firstSource, ...restSources] = namedSources
  const joinKeys: unknown[] = []
  if (firstSource) {
    for (const key of firstSource.byKey.keys()) {
      if (restSources.every(s => s.byKey.has(key)))
        joinKeys.push(key)
    }
  }

  const mergedRows = joinKeys.map((key) => {
    const merged: Record<string, SourceRow> = {}
    for (const { name, byKey } of namedSources)
      merged[name] = byKey.get(key) as SourceRow
    return { key, merged }
  })

  const result: MetricResult = { ...base, available: true }

  if (typeof m.value === 'function') {
    const series: Record<string, number | null> = {}
    for (const { key, merged } of mergedRows)
      series[String(key)] = m.value(merged)
    result.series = series
  }

  if (typeof m.total === 'function') {
    result.total = m.total(mergedRows.map(row => row.merged))
  }

  return result
}
