import { SCHEDULE_ACTIVITIES_LIST_INPUT, SCHEDULE_MEETINGS_LIST_INPUT } from '@/features/schedule-management/constants/schedule-query-inputs'
import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { LoadingState } from '@/shared/components/states/loading-state'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(SCHEDULE_MEETINGS_LIST_INPUT))
    prefetch(trpc.scheduleRouter.activities.list.queryOptions(SCHEDULE_ACTIVITIES_LIST_INPUT))
  }

  return (
    <HydrateClient fallback={<LoadingState title="Loading schedule…" />}>
      <ScheduleView />
    </HydrateClient>
  )
}
