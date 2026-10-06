import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'

import { CAMPAIGN_LEADS_TABLE_QUERY_CONFIG } from '@/features/campaigns-admin/constants/campaign-leads-table-query-config'
import { loadCampaignsSearchParams } from '@/features/campaigns-admin/constants/query-parsers'
import { CampaignsView } from '@/features/campaigns-admin/ui/views/campaigns-view'
import { ROOTS } from '@/shared/config/roots'
import { loadPaginatedQueryInput } from '@/shared/dal/server/lib/query/load-paginated-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function CampaignsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Super-admin only. Agents cannot see this page.
  if (authState.status === 'authenticated' && authState.actor.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    // Only the active tab's queries are prefetched.
    const { tab } = await loadCampaignsSearchParams(searchParams)
    if (tab === 'overview') {
      prefetch(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
      prefetch(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
    }
    // A `?tab=leads` deep link renders the leads table on the server; its first read must be prefetched with the
    // viewer's session (a suspense read without one would fetch cookieless during SSR).
    if (tab === 'leads') {
      prefetch(trpc.voipCampaignsRouter.listLeads.queryOptions(await loadPaginatedQueryInput(searchParams, CAMPAIGN_LEADS_TABLE_QUERY_CONFIG) as never))
    }
  }

  return (
    <HydrateClient>
      <CampaignsView />
    </HydrateClient>
  )
}
