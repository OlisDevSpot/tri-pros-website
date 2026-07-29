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

export { resolve } from './resolver'
export type { MetricResult } from './resolver'

export { bucket, metric, source } from './types'
export type {
  AnalyticsFilters,
  AnyMetric,
  AnySource,
  Bucket,
  BucketSection,
  DateRange,
  MergedRow,
  Metric,
  MetricFormat,
  Source,
  SourceContext,
  SourceRow,
} from './types'
