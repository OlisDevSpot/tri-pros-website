import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'
import { CUSTOMER_PIPELINE_QUERY } from '@/features/customer-pipelines/constants/customer-pipeline-query'

import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { ROOTS } from '@/shared/config/roots'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { getAccessiblePipelines } from '@/shared/domains/pipelines/lib/get-accessible-pipelines'
import { resolvePipelineParam } from '@/shared/domains/pipelines/lib/resolve-pipeline-param'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ pipeline: string }>
  searchParams: Promise<SearchParams>
}

export default async function PipelinePage({ params, searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the prefetch work.
  if (authState.status === 'authenticated') {
    // The same resolution PipelineProvider uses, so the prefetched `pipeline` matches the client's.
    const pipeline = resolvePipelineParam((await params).pipeline)
    const open = getAccessiblePipelines(authState.actor.ability)
    if (!open.includes(pipeline)) {
      redirect(ROOTS.dashboard.pipeline(open[0]))
    }
    const input = await loadDataViewQueryInput(searchParams, CUSTOMER_PIPELINE_QUERY, { pipeline })
    prefetch(trpc.customerPipelinesRouter.getCustomerPipelineItems.queryOptions(input))
  }

  return (
    <HydrateClient>
      <DataViewBoundary>
        <CustomerPipelineView />
      </DataViewBoundary>
    </HydrateClient>
  )
}
