import type { SearchParams } from 'nuqs/server'

import { PROJECTS_TABLE_QUERY_CONFIG } from '@/features/project-management/constants/projects-table-query-config'
import { PortfolioProjectsTable } from '@/features/project-management/ui/components/table'
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

export default async function ProjectsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadPaginatedQueryInput(searchParams, PROJECTS_TABLE_QUERY_CONFIG)
    prefetch(trpc.projectsRouter.crud.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <RecordsPageMotionShell>
        <PortfolioProjectsTable />
      </RecordsPageMotionShell>
    </HydrateClient>
  )
}
