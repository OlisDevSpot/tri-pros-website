// Remote analytics source: Meta ad-level insights keyed by adKey.
// Module-level singleton — stable identity so the resolver dedups it across metrics.
import { metaInsightsSyncService } from '@/shared/services/meta-insights-sync.service'
import { source } from '../../types'

export const adStats = source({
  key: 'adKey',
  load: ({ range }) => metaInsightsSyncService.byAd(range),
})
