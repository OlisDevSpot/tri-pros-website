'use client'

import type { AnalyticsFilterOptions } from '@/features/analytics/dal/server/get-analytics-filter-options'
import type { AnalyticsNames } from '@/features/analytics/lib/format-analytics'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useTRPC } from '@/trpc/helpers'

export function useAnalyticsLabels(): AnalyticsNames & { options: AnalyticsFilterOptions | undefined, closers: { id: string, name: string }[] } {
  const trpc = useTRPC()
  const options = useQuery(trpc.analyticsRouter.filterOptions.queryOptions())
  const users = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions())
  return useMemo(() => {
    const sources = new Map((options.data?.leadSources ?? []).map(s => [s.id, s.name]))
    const closers = users.data ?? []
    const closerNames = new Map(closers.map(u => [u.id, u.name]))
    return {
      options: options.data,
      closers,
      // Until the names arrive a real label would be a lie: "Unknown source" is also the no-source row's name.
      sourceName: id => (options.data ? (sources.get(id) ?? 'Unknown source') : '…'),
      // A closer who left, or whose role changed, still owns their old meetings.
      closerName: id => (users.data ? (closerNames.get(id) ?? 'Former user') : '…'),
    }
  }, [options.data, users.data])
}
