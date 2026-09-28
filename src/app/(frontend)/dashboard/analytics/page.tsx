import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'

import { loadAnalyticsSearchParams } from '@/features/analytics/constants/query-parsers'
import { toReportInput } from '@/features/analytics/lib/to-report-input'
import { AnalyticsView } from '@/features/analytics/ui/views/analytics-view'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Super-admin only. Agents cannot see this page.
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  if (authState.status === 'authenticated') {
    prefetch(trpc.analyticsRouter.report.queryOptions(toReportInput(await loadAnalyticsSearchParams(searchParams))))
  }

  return (
    <HydrateClient>
      <AnalyticsView />
    </HydrateClient>
  )
}
