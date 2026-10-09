import type { SearchParams } from 'nuqs/server'

import { activeProjectsInput, awaitingProposalsInput, DASHBOARD_MEETINGS_EXTRA, DASHBOARD_MEETINGS_QUERY, meetingsWindowInput, onHoldProjectsInput, sentProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function DashboardPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  const ability = authState.status === 'authenticated' ? authState.actor.ability : null
  const showsProposals = ability?.can('read', 'Proposal') ?? false
  const showsProjects = ability?.can('read', 'Project') ?? false

  // Unauthenticated visitors get the layout's sign-in screen; skip the prefetch work.
  if (authState.status === 'authenticated') {
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(await loadDataViewQueryInput(searchParams, DASHBOARD_MEETINGS_QUERY, DASHBOARD_MEETINGS_EXTRA)))
    if (showsProposals) {
      prefetch(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))
      prefetch(trpc.proposalsRouter.business.list.queryOptions(sentProposalsInput()))
    }
    if (showsProjects) {
      prefetch(trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()))
      prefetch(trpc.projectsRouter.crud.list.queryOptions(onHoldProjectsInput()))
    }
  }

  const name = authState.status === 'authenticated' ? authState.session.user.name : null

  return (
    <HydrateClient>
      <DashboardView name={name} showsProjects={showsProjects} showsProposals={showsProposals} />
    </HydrateClient>
  )
}
