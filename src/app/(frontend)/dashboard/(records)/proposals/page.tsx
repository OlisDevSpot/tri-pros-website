import type { SearchParams } from 'nuqs/server'

import { PROPOSALS_TABLE_QUERY_CONFIG } from '@/features/proposal-flow/constants/proposals-table-query-config'
import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { loadPaginatedQueryInput } from '@/shared/dal/server/lib/query/load-paginated-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function ProposalsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadPaginatedQueryInput(searchParams, PROPOSALS_TABLE_QUERY_CONFIG)
    prefetch(trpc.proposalsRouter.business.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <RecordsPageMotionShell>
        <PastProposalsTable />
      </RecordsPageMotionShell>
    </HydrateClient>
  )
}
