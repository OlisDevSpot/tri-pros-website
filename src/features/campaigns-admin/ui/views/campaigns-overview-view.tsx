'use client'

import { useSuspenseQueries } from '@tanstack/react-query'

import { partitionSourceSummaries } from '@/features/campaigns-admin/lib/partition-source-summaries'
import { IdleSourcesList } from '@/features/campaigns-admin/ui/components/overview/idle-sources-list'
import { OverviewSummaryBar } from '@/features/campaigns-admin/ui/components/overview/overview-summary-bar'
import { SourceRollupCard } from '@/features/campaigns-admin/ui/components/overview/source-rollup-card'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { useTRPC } from '@/trpc/helpers'

export function CampaignsOverviewView() {
  const trpc = useTRPC()
  const sourceCampaignSummariesOptions = trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions()
  const listCampaignsOptions = trpc.voipCampaignsRouter.listCampaigns.queryOptions()

  // Dev-only: detect server-prefetch key drift for each query (see hydration-drift.ts).
  useHydrationParityCheck(sourceCampaignSummariesOptions.queryKey)
  useHydrationParityCheck(listCampaignsOptions.queryKey)

  // useSuspenseQueries (plural), NOT two useSuspenseQuery calls — sequential
  // suspense hooks in one component waterfall; the plural API fires both in
  // parallel and matches the page's two parallel prefetches.
  const [{ data: summaries }, { data: campaigns }] = useSuspenseQueries({
    queries: [sourceCampaignSummariesOptions, listCampaignsOptions],
  })

  const totals = summaries.reduce(
    (acc, s) => ({
      dnc: acc.dnc + s.dncCount,
      eligible: acc.eligible + s.eligibleCount,
      enrolled: acc.enrolled + s.enrolledCount,
    }),
    { dnc: 0, eligible: 0, enrolled: 0 },
  )

  const { actionable, idle } = partitionSourceSummaries(summaries)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pr-1">
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
                <SourceRollupCard campaigns={campaigns} summary={s} />
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
