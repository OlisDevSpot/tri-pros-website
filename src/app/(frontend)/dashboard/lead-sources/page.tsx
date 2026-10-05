import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'

import { ALL_CUSTOMERS_TABLE_QUERY_CONFIG } from '@/features/lead-sources-admin/constants/lead-sources-table-query-configs'
import { ALL_PSEUDO_ID } from '@/features/lead-sources-admin/constants/pseudo-ids'
import { LeadSourcesView } from '@/features/lead-sources-admin/ui/views/lead-sources-view'
import { ROOTS } from '@/shared/config/roots'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function LeadSourcesPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Super-admin only. Agents cannot see this page.
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  if (authState.status === 'authenticated') {
    // The "all sources" pane renders on the server while the source list loads, so its customers table suspends
    // there; a one-source pane mounts its table only after a client read.
    const params = await searchParams
    if ((params.id ?? ALL_PSEUDO_ID) === ALL_PSEUDO_ID && params.tab !== 'analytics') {
      const input = await loadDataViewQueryInput(params, ALL_CUSTOMERS_TABLE_QUERY_CONFIG)
      prefetch(trpc.customersRouter.business.list.queryOptions(input))
    }
  }

  return (
    <HydrateClient>
      <LeadSourcesView />
    </HydrateClient>
  )
}
