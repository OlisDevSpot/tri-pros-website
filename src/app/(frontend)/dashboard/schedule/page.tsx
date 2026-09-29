import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'
import { createLoader } from 'nuqs/server'

import { scheduleShowParser } from '@/features/schedule-management/constants/query-parsers'
import { SCHEDULE_ACTIVITIES_QUERY, SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { toScheduleWindowHref } from '@/features/schedule-management/lib/to-schedule-window-href'
import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { LoadingState } from '@/shared/components/states/loading-state'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function SchedulePage({ searchParams }: Props) {
  const params = await searchParams
  // Converting here, not in the browser, keeps the prefetched window and the client's first window identical.
  const legacyRedirect = toScheduleWindowHref(params)
  if (legacyRedirect !== null) {
    redirect(legacyRedirect)
  }

  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the prefetch work.
  if (authState.status === 'authenticated') {
    const { show } = await createLoader({ show: scheduleShowParser })(params)
    if (show === 'activities') {
      prefetch(trpc.scheduleRouter.activities.list.queryOptions(await loadDataViewQueryInput(params, SCHEDULE_ACTIVITIES_QUERY)))
    }
    else {
      prefetch(trpc.meetingsRouter.reads.list.queryOptions(await loadDataViewQueryInput(params, SCHEDULE_MEETINGS_QUERY)))
    }
  }

  return (
    <HydrateClient fallback={<LoadingState title="Loading schedule…" />}>
      <ScheduleView />
    </HydrateClient>
  )
}
