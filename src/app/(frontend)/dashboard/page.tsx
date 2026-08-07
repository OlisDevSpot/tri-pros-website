import { activeProjectsInput, awaitingProposalsInput, meetingsMonthInput, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { businessToday } from '@/features/agent-dashboard/lib/meeting-windows'
import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work. Only Today's meetings are prefetched here — Upcoming/Past
  // are lazily fetched by their tabs later (Task 6).
  if (authState.status === 'authenticated') {
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(meetingsMonthInput(businessToday())))
    prefetch(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))
    prefetch(trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()))
  }

  return (
    <HydrateClient>
      <DashboardView />
    </HydrateClient>
  )
}
