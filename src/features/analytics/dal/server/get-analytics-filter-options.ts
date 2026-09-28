import type { DalReturn } from '@/shared/dal/server/types'

import { loadAnalyticsFacts } from '@/features/analytics/dal/server/load-analytics-facts'
import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
import { listLeadPlaces } from '@/features/analytics/lib/list-lead-places'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { listLeadSources } from '@/shared/entities/lead-sources/dal/server/queries'

export interface AnalyticsFilterOptions {
  // Archived sources stay listed so their old leads keep a name.
  leadSources: { id: string, name: string, archived: boolean }[]
  cities: string[]
  zips: string[]
}

export async function getAnalyticsFilterOptions(now: Date): Promise<DalReturn<AnalyticsFilterOptions>> {
  return dalDbOperation(async () => {
    const [facts, sources] = await Promise.all([loadAnalyticsFacts(), listLeadSources()])
    return {
      leadSources: dalVerifySuccess(sources).map(s => ({ id: s.id, name: s.name, archived: s.archivedAt !== null })),
      ...listLeadPlaces(buildLeadRecords(dalVerifySuccess(facts), now)),
    }
  })
}
