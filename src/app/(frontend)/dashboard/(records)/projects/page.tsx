import type { SearchParams } from 'nuqs/server'

import { PROJECTS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/projects-records-table-view'
import { ProjectsRecordsView } from '@/features/records-management/ui/views/projects-records-view'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function ProjectsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadDataViewQueryInput(searchParams, PROJECTS_RECORDS_TABLE_VIEW.query)
    prefetch(trpc.projectsRouter.crud.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <ProjectsRecordsView />
    </HydrateClient>
  )
}
