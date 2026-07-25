import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'

import { loadCampaignsSearchParams } from '@/features/campaigns-admin/constants/query-parsers'
import { CampaignsView } from '@/features/campaigns-admin/ui/views/campaigns-view'
import { ROOTS } from '@/shared/config/roots'
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
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  // Tier 1 (suspense view): void prefetch — pending queries are dehydrated
  // and streamed; the view's useSuspenseQueries resolves them without a
  // client round-trip. Only the active tab's queries are prefetched.
  const { tab } = await loadCampaignsSearchParams(searchParams)
  if (tab === 'overview') {
    void prefetch(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
    void prefetch(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  }

  return (
    <HydrateClient>
      <CampaignsView />
    </HydrateClient>
  )
}
