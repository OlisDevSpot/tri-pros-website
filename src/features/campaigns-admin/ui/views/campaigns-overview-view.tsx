'use client'

import { useQuery } from '@tanstack/react-query'

import { partitionSourceSummaries } from '@/features/campaigns-admin/lib/partition-source-summaries'
import { IdleSourcesList } from '@/features/campaigns-admin/ui/components/overview/idle-sources-list'
import { OverviewSummaryBar } from '@/features/campaigns-admin/ui/components/overview/overview-summary-bar'
import { SourceRollupCard } from '@/features/campaigns-admin/ui/components/overview/source-rollup-card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

export function CampaignsOverviewView() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions(),
  )
  const summaries = data ?? []

  const totals = summaries.reduce(
    (acc, s) => ({
      dnc: acc.dnc + s.dncCount,
      eligible: acc.eligible + s.eligibleCount,
      enrolled: acc.enrolled + s.enrolledCount,
    }),
    { dnc: 0, eligible: 0, enrolled: 0 },
  )

  const { actionable, idle } = partitionSourceSummaries(summaries)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 overflow-y-auto">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="h-44 w-full"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto">
      <OverviewSummaryBar
        dnc={totals.dnc}
        eligible={totals.eligible}
        enrolled={totals.enrolled}
      />

      {actionable.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {`Needs action · ${actionable.length}`}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {actionable.map(s => (
              <li key={s.sourceSlug}>
                <SourceRollupCard summary={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <IdleSourcesList summaries={idle} />

      {summaries.length === 0 && (
        <p className="text-sm text-muted-foreground">No lead sources found.</p>
      )}
    </div>
  )
}
