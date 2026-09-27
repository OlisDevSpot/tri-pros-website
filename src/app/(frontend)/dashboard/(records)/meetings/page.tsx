import type { SearchParams } from 'nuqs/server'

import { MEETINGS_TABLE_QUERY_CONFIG } from '@/features/meeting-flow/constants/meetings-table-query-config'
import { PastMeetingsTable } from '@/features/meeting-flow/ui/components/table'
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

export default async function MeetingsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadPaginatedQueryInput(searchParams, MEETINGS_TABLE_QUERY_CONFIG)
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <RecordsPageMotionShell>
        <PastMeetingsTable />
      </RecordsPageMotionShell>
    </HydrateClient>
  )
}
